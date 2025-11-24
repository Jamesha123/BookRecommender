# 📘 Book Recommendation REST API

A Node.js and Express-based REST API that provides personalized book recommendations. This project integrates with the Google Books API for real-time book data and uses JWT for secure user authentication.

## ⭐ Features

-   **User Authentication**: Secure user registration and login using JSON Web Tokens (JWT).
-   **External API Integration**: Search for any book using the extensive Google Books API.
-   **Personalized Recommendations**: Get book recommendations based on your personal list of liked books.
-   **CRUD Operations**: Save your favorite books and manage your liked/disliked lists.
-   **Interactive Documentation**: Explore and test all API endpoints using the integrated Swagger UI.
-   **Containerized**: Ready for deployment with a complete Dockerfile.

## 🏗️ Project Architecture

```
/book-api
 ├─ src
 │   ├─ controllers
 │   ├─ routes
 │   ├─ services
 │   ├─ models
 │   ├─ middlewares
 │   ├─ app.js
 │   └─ server.js
 ├─ tests
 ├─ .env
 ├─ package.json
 ├─ Dockerfile
 └─ README.md
```

## 🔧 Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB (with Mongoose)
-   **Authentication**: JSON Web Tokens (JWT), bcrypt.js
-   **API Testing**: Jest, Supertest
-   **Documentation**: Swagger (OpenAPI)
-   **Containerization**: Docker

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18 or higher recommended)
-   MongoDB (either a local installation or a free MongoDB Atlas cloud database)
-   Docker (optional, for containerization)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd book-api
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables.

    ```env
    PORT=3000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_super_secret_jwt_key
    ```
    Replace `your_mongodb_connection_string` with your actual MongoDB connection URI and choose a strong `JWT_SECRET`.

### Running the Application

-   **Development Mode** (with auto-restarting):
    ```bash
    npm run dev
    ```

-   **Production Mode**:
    ```bash
    npm start
    ```

The server will be running at `http://localhost:3000`.

### Running Tests

To run the full suite of integration tests:

```bash
npm test
```

## 📡 API Endpoints

All endpoints are prefixed with `/api`.

### Interactive Documentation

For a full, interactive API specification, run the server and navigate to:
**[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

This Swagger UI allows you to explore and test all available endpoints directly from your browser.

### Authentication (`/auth`)

-   `POST /register`: Create a new user account.
-   `POST /login`: Log in and receive a JWT.

### Book Search (`/books`)

-   `GET /search?q={query}`: Search for books by title or author.
-   `GET /{id}`: Get detailed information for a specific book by its Google Books ID.

### User Actions (`/user`)

*(Authentication required for all user endpoints)*

-   `POST /like`: Add a book to your liked list.
-   `POST /dislike`: Add a book to your disliked list.
--   `GET /likes`: Retrieve a list of all your liked books.
-   `GET /recommendations`: Get a list of personalized book recommendations.

## 🐳 Docker Support

You can build and run this application as a Docker container.

1.  **Build the image:**
    ```bash
    docker build -t book-recommender-api .
    ```

2.  **Run the container:**
    ```bash
    docker run -p 3000:3000 -e MONGO_URI="your_mongodb_connection_string" -e JWT_SECRET="your_jwt_secret" book-recommender-api
    ```
    *Note: You must pass your environment variables directly to the `docker run` command.*

## 📄 Postman Collection

A Postman collection is included in the root of this project: `Book-Recommendation-API.postman_collection.json`. You can import this file into Postman for a ready-to-use testing suite for the API.
