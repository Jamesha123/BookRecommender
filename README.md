# BookRecommender

A full-stack book recommendation app with a **trained** hybrid machine learning pipeline. Search books via the Google Books API, build a taste profile from likes and dislikes, queue titles to read next, and get ranked recommendations from a model that learns from user feedback.

## Features

### Web UI (`http://localhost:3000`)

- **Search** — Find books by title, author, or genre; liked titles show a ✓ marker
- **Likes** — Add books with **+** from search or recommendations; remove with **×**
- **Next read** — Queue books with **→** from search or recommendations
- **ML recommendations** — Hybrid-ranked picks with:
  - **−** dislike (hidden from future recommendations)
  - **→** add to next read
  - **+** like
  - Always-visible **ML score** (0–100%) plus **What is the score?** explanation
  - **Refresh** — fetches a new batch (skips books already shown this session)
  - **Recommend 8 more** — appends the next batch and auto-expands the list
- **Smart filtering** — Books in likes or next read are never recommended again
- **Deduplication** — Filters duplicate editions, movie tie-ins, and box sets/trilogies
- **Collapsible lists** — Panels with 8+ books show **Show more / Show less**

### API

- JWT authentication (register / login)
- Book search and detail lookup
- Like, unlike, dislike, next-read tracking
- ML recommendations with scores, reasons, and pagination support
- Swagger docs at `/api-docs`
- Health check at `/api/health`

### ML engine

- **Trained hybrid ranker** — Matrix factorization + TF-IDF features, blended by a learned logistic ranker
- **Automatic retraining** — Model updates when users like, unlike, or dislike books
- **Persistent artifacts** — Trained models stored in MongoDB (`MLModel` collection)
- **Candidate discovery** — Genre/author searches via Google Books plus MongoDB cache fallback
- **Rate-limit handling** — Batched API calls with graceful fallback when Google returns 429
- **Book cache** — Liked and candidate books stored in MongoDB for richer features and fewer API calls

## ML Approach

The app uses a real **train → store → infer** pipeline:

```text
User likes/dislikes  →  Training dataset  →  Trained model artifact  →  Recommendation scores
```

### 1. Training (`src/ml/training/`)

| Step | Method | What it learns |
|------|--------|----------------|
| Content features | TF-IDF vocabulary | Word importance across the book catalog |
| Collaborative signal | Matrix factorization (SGD) | 16-dimensional user and book latent factors from likes/dislikes |
| Final ranker | Logistic regression (SGD) | Weights that combine content + collaborative features into a like probability |

Training runs:
- On server startup (if no model exists or the model is stale)
- After like / unlike / dislike changes
- Manually via `npm run train`

### 2. Inference (`src/ml/inference/`)

For each candidate book:
1. **Content score** — Cosine similarity between the candidate's TF-IDF vector and the user's liked-book profile (using the trained vocabulary)
2. **Collaborative score** — Sigmoid of the dot product between the user's latent factor and the book's latent factor
3. **Final score** — `sigmoid(bias + w₁×content + w₂×collaborative)` using **learned** ranker weights

Cold-start handling:
- New users infer a latent factor from the average of their liked books' factors
- Books not yet seen in training still get a content score

### 3. Retrieval + filtering (unchanged)

Books are gathered from Google Books category searches and the local cache, deduplicated, then passed to the trained ranker.

## Project Structure

```
BookRecommender/
├── public/                     # Web frontend (HTML, CSS, JS)
│   ├── index.html              # Main app
│   ├── login.html
│   ├── register.html
│   ├── app.js
│   ├── auth.js
│   └── styles.css
├── src/
│   ├── config/                 # Env loading, database connection
│   ├── controllers/
│   ├── middlewares/
│   ├── ml/
│   │   ├── training/           # Dataset builder, MF, logistic ranker, trainer
│   │   ├── inference/          # Predictor used at request time
│   │   ├── math/               # Linear algebra helpers
│   │   ├── config.js
│   │   └── modelStore.js       # Load/cache/retrain model artifacts
│   ├── models/                 # User, Book cache, MLModel
│   ├── routes/
│   ├── services/
│   │   ├── bookService.js
│   │   ├── bookCacheService.js
│   │   └── recommendationService.js
│   └── utils/
│       ├── bookDeduplication.js
│       ├── bookFeatures.js
│       ├── contentModel.js     # Fallback content scoring
│       └── similarity.js
├── scripts/
│   └── train.js                # Manual training entry point
├── tests/
├── Dockerfile
└── .env.example
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
- MongoDB (local or [MongoDB Atlas](https://cloud.mongodb.com))

### Installation

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your values:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_BOOKS_API_KEY=optional_for_higher_search_limits
```

### Run

```bash
npm run dev
```

- **Web UI**: `http://localhost:3000`
- **Swagger**: `http://localhost:3000/api-docs`
- **Health**: `http://localhost:3000/api/health`

Like at least a few books (10+ gives the best results), then open **ML Recommendations** and click **Refresh**.

### Train the model manually

```bash
npm run train
```

This exports likes/dislikes from MongoDB, trains matrix factorization + logistic ranker weights, and saves a new artifact to the `MLModel` collection.

### Tests

```bash
npm test
```

Unit tests for ML utilities and deduplication run without external services. Integration tests require MongoDB and may call Google Books.

### MongoDB Atlas free tier

Atlas free clusters can pause after long inactivity. If login or recommendations fail:

1. Open your cluster in the [MongoDB Atlas dashboard](https://cloud.mongodb.com)
2. Click **Resume** if the cluster is paused
3. Wait about a minute, then retry

The API keeps running without the database and reconnects automatically. Book search still works while MongoDB is waking up.

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Log in and receive JWT |

### Books

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/books/search?q=` | Search Google Books |
| `GET` | `/books/:id` | Book details |

### User (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/user/like` | Like a book `{ bookId, book? }` |
| `POST` | `/user/unlike` | Remove a like `{ bookId }` |
| `POST` | `/user/dislike` | Dislike a book `{ bookId, book? }` |
| `GET` | `/user/likes` | List liked books |
| `GET` | `/user/next-read` | List next-read queue |
| `POST` | `/user/next-read` | Add to next read `{ bookId, book? }` |
| `POST` | `/user/next-read/remove` | Remove from next read `{ bookId }` |
| `GET` | `/user/recommendations` | ML-ranked recommendations |

### Recommendations query parameters

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `8` | Number of results (1–20) |
| `exclude` | — | Comma-separated book IDs to skip (used for refresh and load-more) |

Example response:

```json
{
  "model": "trained-hybrid-v1",
  "trainedAt": "2026-07-07T18:00:00.000Z",
  "weights": { "content": 0.62, "collaborative": 0.38 },
  "hasMore": true,
  "results": [
    {
      "id": "...",
      "title": "...",
      "authors": ["..."],
      "score": 0.82,
      "contentScore": 0.91,
      "collaborativeScore": 0.65,
      "reason": "Similar writing style, themes, and genres to books you liked"
    }
  ]
}
```

`weights` are normalized from the trained ranker. They update after retraining.

## Docker

```bash
docker build -t bookrecommender .
docker run -p 3000:3000 \
  -e MONGO_URI="your_mongodb_connection_string" \
  -e JWT_SECRET="your_jwt_secret" \
  bookrecommender
```

## Postman

Import `Book-Recommendation-API.postman_collection.json` for ready-made API tests.
