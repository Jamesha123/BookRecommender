const axios = require('axios');

const searchBooks = async (query) => {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    
    if (response.data.items) {
      return response.data.items.map(book => ({
        id: book.id,
        title: book.volumeInfo.title,
        authors: book.volumeInfo.authors || [],
        categories: book.volumeInfo.categories || [],
        description: book.volumeInfo.description,
        thumbnail: book.volumeInfo.imageLinks?.thumbnail,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error searching books:', error.message);
    throw new Error('Failed to search for books');
  }
};

const getBookById = async (bookId) => {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes/${bookId}`;
    const response = await axios.get(url);
    
    const book = response.data;
    return {
      id: book.id,
      title: book.volumeInfo.title,
      authors: book.volumeInfo.authors || [],
      categories: book.volumeInfo.categories || [],
      description: book.volumeInfo.description,
      thumbnail: book.volumeInfo.imageLinks?.thumbnail,
    };
  } catch (error) {
    console.error(`Error fetching book with ID ${bookId}:`, error.message);
    throw new Error('Failed to fetch book details');
  }
};

const getBooksByIds = async (bookIds) => {
  if (!bookIds || bookIds.length === 0) {
    return [];
  }
  
  try {
    const bookPromises = bookIds.map(id => getBookById(id));
    const books = await Promise.all(bookPromises);
    return books;
  } catch (error) {
    console.error('Error fetching multiple books:', error.message);
    throw new Error('Failed to fetch book details for the list');
  }
};


module.exports = {
  searchBooks,
  getBookById,
  getBooksByIds,
};
