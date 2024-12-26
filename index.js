const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { Model } = require("./utils/orm");

const app = express();
const port = 1337;
const JWT_SECRET = "your-secret-key";

// Initialize database and create Model instance
const db = new sqlite3.Database("database.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Connected to the database.");

    // Create only the users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )
    `);
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Load plugins
const pluginsDir = path.join(__dirname, "plugins");
if (fs.existsSync(pluginsDir)) {
  fs.readdirSync(pluginsDir).forEach((file) => {
    if (file.endsWith(".js")) {
      const plugin = require(path.join(pluginsDir, file));
      if (plugin.routes && Array.isArray(plugin.routes)) {
        plugin.routes.forEach((route) => {
          const method = route.method.toLowerCase();
          if (app[method]) {
            // Create middleware chain
            const middlewares = [];

            // Add authentication middleware if route requires auth
            if (route.requiresAuth) {
              middlewares.push(authenticateToken);
            }

            // Add the main route handler with user and Model access
            middlewares.push((req, res) => {
              // Create context with user and Model
              const context = {
                user: req.user, // Will be undefined if no auth
                Model: (tableName) => new Model(db, tableName),
                req: req,
                res: res,
              };

              // Call the handler with the context
              route.handler(context);
            });

            // Register the route with all middlewares
            app[method](route.path, ...middlewares);
            console.log(
              `Loaded route: ${route.method} ${route.path} from ${file}`
            );
          }
        });
      }
    }
  });
}

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Configure middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use(
  "/uploads",
  express.static(uploadDir, {
    setHeaders: (res, path) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
    },
  })
);

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Register endpoint
app.post("/register", authLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      function (err) {
        if (err) {
          return res.status(400).json({ message: "Username already exists" });
        }
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
        res.status(201).json({ token });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Error creating user" });
  }
});

// Login endpoint
app.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Error finding user" });
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET
      );
      res.json({ token });
    }
  );
});

// Me endpoint
app.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Middleware to handle dynamic endpoints
app.use(authenticateToken, async (req, res, next) => {
  if (req.method === "POST" || req.method === "PUT") {
    console.log("Received POST or PUT request, authenticating token");
    const endpoint = req.path.substring(1).split("/")[0];

    // Skip schema handling and table creation here
    // We'll handle it in the route handler
    next();
  } else {
    next();
  }
});

// Handle POST requests dynamically
app.post(
  "/:resourceType",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    const { resourceType } = req.params;
    const tableName = resourceType.toLowerCase();

    console.log("Received POST request for", tableName, resourceType);

    try {
      // Get all possible columns including file upload
      let columns = Object.keys(req.body).filter(
        (key) => key !== "id" && req.body[key] !== undefined
      );

      // Always add these columns if needed
      if (req.file && !columns.includes("image_url")) columns.push("image_url");
      if (!columns.includes("created_at")) columns.push("created_at");

      console.log("Columns to be created:", columns);

      // First check if table exists
      let existingColumns = await new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          if (err) {
            console.error("Error fetching table info:", err.message);
            reject(err);
          } else {
            resolve(rows.map((row) => row.name));
          }
        });
      });

      if (existingColumns.length === 0) {
        // Table doesn't exist, create it with all columns
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${columns.map((col) => `${col} TEXT`).join(", ")}
        )`;

        console.log("Creating new table:", createTableQuery);

        await new Promise((resolve, reject) => {
          db.run(createTableQuery, (err) => {
            if (err) {
              console.error("Error creating table:", err.message);
              reject(err);
            } else {
              console.log("Table created successfully");
              resolve();
            }
          });
        });
      } else {
        // Table exists, add any missing columns
        console.log("Existing columns:", existingColumns);
        for (const col of columns) {
          if (!existingColumns.includes(col)) {
            const alterTableQuery = `ALTER TABLE ${tableName} ADD COLUMN ${col} TEXT`;
            console.log("Adding column:", alterTableQuery);

            await new Promise((resolve, reject) => {
              db.run(alterTableQuery, (err) => {
                if (err) {
                  console.error(`Error adding column ${col}:`, err.message);
                  reject(err);
                } else {
                  console.log(`Column ${col} added successfully`);
                  resolve();
                }
              });
            });
          }
        }
      }

      // Prepare values for insert
      const values = columns.map((col) => {
        if (col === "created_at") {
          return new Date().toISOString();
        }
        if (col === "image_url") {
          return req.file ? `/uploads/${req.file.filename}` : null;
        }
        return req.body[col];
      });

      const placeholders = columns.map(() => "?").join(", ");
      const insertQuery = `INSERT INTO ${tableName} (${columns.join(
        ", "
      )}) VALUES (${placeholders})`;
      console.log(
        "Insert query:",
        `INSERT INTO ${tableName} (${columns.join(
          ", "
        )}) VALUES (${placeholders})`
      );

      console.log("Insert query:", insertQuery);
      console.log("Values:", values);

      // Insert the data
      await new Promise((resolve, reject) => {
        db.run(insertQuery, values, function (err) {
          if (err) {
            console.error("Error inserting resource:", err.message);
            reject(err);
          } else {
            const createdResource = {
              id: this.lastID,
              ...req.body,
            };
            if (req.file) {
              createdResource.image_url = `/uploads/${req.file.filename}`;
            }
            console.log("Created resource:", createdResource);
            resolve(createdResource);
          }
        });
      }).then((createdResource) => {
        res.status(201).json(createdResource);
      });
    } catch (error) {
      console.error("Error handling resource:", error.message);
      res.status(500).json({ message: "Error creating resource" });
    }
  }
);

// Dynamic GET endpoints
app.get("/:resource/:id?", authenticateToken, async (req, res) => {
  const resource = req.params.resource;
  const id = req.params.id;
  const tableName = resource.replace(/[^a-zA-Z0-9_]/g, "_");

  try {
    // Check if schema exists
    const schemaPath = path.join(__dirname, `${resource}.schema.json`);
    await fs.promises.access(schemaPath);

    if (id) {
      // Get single resource
      db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
        if (err) {
          console.log("Error fetching resource:", err.message);
          return res.status(200).json([]);
        }
        if (!row) {
          return res.status(404).json({ message: "Resource not found" });
        }
        res.json(row);
      });
    } else {
      // Get all resources
      db.all(`SELECT * FROM ${tableName} ORDER BY id DESC`, (err, rows) => {
        if (err) {
          console.error("Error fetching resources:", err.message);
          return res.status(200).json([]);
        }
        res.json(rows);
      });
    }
  } catch (error) {
    console.error("Error fetching resources:", error.message);
    return res.status(200).json([]);
  }
});

app.get("*", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
