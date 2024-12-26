create a NodeJS based tiny backend with auth and ACL

Use the following stack:

- nodemon
- express
- helmet
- express-api-builder
- sqlite3
- jsonwebtoken
- multer

This backend must be built as it is running. This means that whenever a post or put requests come in for an endpoint this process must occurr:

- a file with that endpont name is located
- if the file does not exist, it will be created and will be populated with a JSON schema that matches the post/put request parameters
- if it does exist, it will be updated with new parameters extrapolated from the post/put request. No properties will be removed, only added
- this schema wil lbe updated for the sqlite database

The backend must be able to upload images using the `multer` middleware to an "upload" folder.

This will allow the backend to be spun up and be ready for whatever use it is necessary, it is a prototype friendly backend.

The backend will come pre-loaded with an auth flow that allows for the following operations:
/register
/login
/me
