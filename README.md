# Book Recommender

A full-stack book recommendation app with a hybrid machine learning engine. Search books via the Google Books API, like titles to build a taste profile, and get ranked recommendations powered by TF-IDF content similarity and collaborative filtering.

## Features

- **Hybrid ML recommendations**: Combines TF-IDF cosine similarity on book text features with user-user and item-item collaborative filtering
- **Web UI**: Search, like/dislike, and view scored recommendations at `http://localhost:3000`
- **REST API**: JWT auth, book search, preference tracking, and Swagger docs
- **Book cache**: Liked and candidate books are stored in MongoDB to improve ML feature quality and reduce API calls
- **Docker-ready**: Containerized deployment included

## ML Approach

The recommender uses a two-stage hybrid model:

1. **Content-based (60%)** — Builds TF-IDF vectors from each book's title, authors, categories, and description, then scores candidates by cosine similarity to the user's average liked-book profile.
2. **Collaborative filtering (40%)** — Finds similar users via Jaccard similarity on liked books and boosts books co-liked with the user's favorites.

Candidate books are gathered from Google Books searches (categories, authors, related titles) plus the local cache, then ranked and returned with ML scores and explanations.

## Project Structure

```
BookRecommender/
├── public/                  # Web frontend
├── src/
│   ├── controllers/
│   ├── models/              # User + Book cache
│   ├── routes/
│   ├── services/
│   │   ├── bookService.js
│   │   ├── bookCacheService.js
│   │   └── recommendationService.js   # ML engine
│   └── utils/bookFeatures.js
├── tests/
└── Dockerfile
```

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB, Mongoose
- **ML**: Custom TF-IDF content model + collaborative filtering
- **External data**: Google Books API
- **Auth**: JWT, bcrypt
- **Testing**: Jest, Supertest

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
npm install
```

Create a `.env` file:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000` for the UI, or `http://localhost:3000/api-docs` for Swagger.

### Tests

```bash
npm test
```

Integration tests require MongoDB and network access to Google Books.

### MongoDB Atlas free tier

Atlas free clusters can pause after long inactivity. If login or recommendations fail:

1. Open your cluster in the [MongoDB Atlas dashboard](https://cloud.mongodb.com)
2. Click **Resume** if the cluster is paused
3. Wait about a minute, then retry

The API keeps running without the database and will reconnect automatically. Book search still works while MongoDB is waking up. Check status at `GET /api/health`.

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth

- `POST /auth/register` — Create account
- `POST /auth/login` — Log in and receive JWT

### Books

- `GET /books/search?q=` — Search Google Books
- `GET /books/:id` — Book details

### User (JWT required)

- `POST /user/like` — Like a book
- `POST /user/dislike` — Dislike a book
- `GET /user/likes` — Liked books
- `GET /user/recommendations` — ML-ranked recommendations with scores

Example recommendation response:

```json
{
  "model": "hybrid-tfidf-collaborative-filtering",
  "weights": { "content": 0.6, "collaborative": 0.4 },
  "results": [
    {
      "id": "...",
      "title": "...",
      "score": 0.82,
      "contentScore": 0.91,
      "collaborativeScore": 0.65,
      "reason": "Similar writing style, themes, and genres to books you liked"
    }
  ]
}
```

## Docker

```bash
docker build -t book-recommender-api .
docker run -p 3000:3000 \
  -e MONGO_URI="your_mongodb_connection_string" \
  -e JWT_SECRET="your_jwt_secret" \
  book-recommender-api
```

## Postman

Import `Book-Recommendation-API.postman_collection.json` for ready-made API tests.
