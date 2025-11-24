const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const setupTestDB = require('./setup');

setupTestDB();

let token;
let userId;

// Setup: Register a user and get a token before running user/book tests
beforeAll(async () => {
  // Need to clear users before this specific beforeAll, as it runs after the global one
  await User.deleteMany({});
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'userfortests@example.com',
      password: 'password123',
    });
  token = res.body.token;
  userId = res.body._id;
});


describe('Book Endpoints', () => {
  it('should search for books', async () => {
    const res = await request(app)
      .get('/api/books/search?q=dune');
    expect(res.statusCode).toEqual(200);
    expect(res.body.results).toBeInstanceOf(Array);
  });

  it('should get book details by ID', async () => {
    const res = await request(app)
      .get('/api/books/search?q=dune');
    const bookId = res.body.results[0].id;

    const detailsRes = await request(app)
      .get(`/api/books/${bookId}`);
    expect(detailsRes.statusCode).toEqual(200);
    expect(detailsRes.body).toHaveProperty('id', bookId);
  });
});

describe('User Endpoints', () => {
  const bookIdToLike = 'zyTCAlFPjgYC'; // A specific ID for a Dune book

  it('should allow a logged-in user to like a book', async () => {
    const res = await request(app)
      .post('/api/user/like')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: bookIdToLike });
    expect(res.statusCode).toEqual(200);

    const user = await User.findById(userId);
    expect(user.likedBooks).toContain(bookIdToLike);
  });
  
  it('should retrieve a list of liked books', async () => {
    // First, like a book
    await request(app)
      .post('/api/user/like')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: bookIdToLike });
      
    // Then, get the list
    const res = await request(app)
      .get('/api/user/likes')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id', bookIdToLike);
  });

  it('should generate recommendations for a user', async () => {
    await request(app)
      .post('/api/user/like')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: bookIdToLike }); // Dune is in "Fiction"

    const res = await request(app)
      .get('/api/user/recommendations')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.results).toBeInstanceOf(Array);
  });
});
