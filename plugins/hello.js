module.exports = {
  // Define routes as objects with method, path, and handler
  routes: [
    {
      method: "GET",
      path: "/hello",
      handler: ({ req, res, user, Model }) => {
        const greeting = user ? `Hello ${user.username}!` : "Hello World!";
        res.send(greeting);
      },
    },
    {
      method: "GET",
      path: "/users",
      handler: async ({ res, Model }) => {
        // Example of using the ORM
        const usersModel = Model("users");

        const allUsers = await usersModel.find();

        res.json({
          users: allUsers,
        });
      },
    },
    {
      method: "GET",
      path: "/tables",
      requiresAuth: false,
      handler: async ({ res, Model }) => {
        // list all the tables in the database
        const tables = await Model().listTables();
        res.json(tables);
      },
    },
    {
      method: "GET",
      path: "/hello/private",
      requiresAuth: true,
      handler: async ({ req, res, user, Model }) => {
        // Example of using the ORM
        const usersModel = Model("users");
        const allUsers = await usersModel.find();

        res.json({
          message: `Hello ${user.username}! There are ${allUsers.length} users registered.`,
          currentUser: user,
        });
      },
    },
  ],
};
