const state = {
  token: localStorage.getItem('token') || '',
  email: localStorage.getItem('email') || '',
  likedBookIds: new Set(),
  nextReadBookIds: new Set(),
  lastSearchResults: [],
  booksById: new Map(),
  expandedPanels: new Set(),
  panelRenderCache: new Map(),
  recommendationResults: [],
  seenRecommendationIds: new Set(),
  hasMoreRecommendations: false,
  dislikedBookIds: new Set(),
  recommendationsLoading: false,
  loadingMoreRecommendations: false,
  expandedCards: new Set(),
};

const ACTION_CONTAINERS = '#search-results, #recommendations, #liked-books, #next-read-books';
const COLLAPSE_THRESHOLD = 9;
const COLLAPSE_PREVIEW_COUNT = 8;

const authPanel = document.getElementById('auth-panel');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const nextReadBooks = document.getElementById('next-read-books');
const likedBooks = document.getElementById('liked-books');
const recommendations = document.getElementById('recommendations');
const modelInfo = document.getElementById('model-info');
const refreshRecommendations = document.getElementById('refresh-recommendations');
const scoreHelpBtn = document.getElementById('score-help-btn');
const scoreHelpPanel = document.getElementById('score-help-panel');
const loadMoreRecommendations = document.getElementById('load-more-recommendations');
const bookCardTemplate = document.getElementById('book-card-template');

const apiFetch = async (path, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

const redirectToLogin = () => {
  window.location.href = '/login.html';
};

const renderAuthPanel = () => {
  if (state.token) {
    authPanel.innerHTML = `
      <div class="auth-actions">
        <div class="status">Signed in as ${state.email}</div>
        <button id="logout-btn" class="secondary" type="button">Log out</button>
      </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => {
      state.token = '';
      state.email = '';
      state.likedBookIds = new Set();
      state.nextReadBookIds = new Set();
      state.dislikedBookIds = new Set();
      state.recommendationResults = [];
      state.seenRecommendationIds = new Set();
      state.hasMoreRecommendations = false;
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      renderAuthPanel();
      clearBookPanel(nextReadBooks, 'Log in to build your next read list.');
      clearBookPanel(likedBooks, 'Log in to track likes and get recommendations.');
      clearBookPanel(recommendations, 'Like a few books to train the recommender.');
      modelInfo.textContent = '';
      if (loadMoreRecommendations) {
        loadMoreRecommendations.classList.add('hidden');
      }
      refreshSearchResults();
    });
    return;
  }

  authPanel.innerHTML = `
    <div class="auth-actions">
      <a class="button-link" href="/login.html">Log in</a>
      <a class="button-link primary" href="/register.html">Create account</a>
    </div>
  `;
};

const rememberBook = (book) => {
  if (book?.id) {
    state.booksById.set(book.id, book);
  }
};

const rememberBooks = (books = []) => {
  books.forEach(rememberBook);
};

const syncActionButtonsInContainer = (container) => {
  container.querySelectorAll('.book-card').forEach((card) => {
    const bookId = card.dataset.bookId;
    const likeBtn = card.querySelector('.like-btn');
    const nextReadBtn = card.querySelector('.next-read-btn');

    if (likeBtn && !likeBtn.classList.contains('remove-btn')) {
      setLikeButtonState(likeBtn, state.likedBookIds.has(bookId) ? 'liked' : 'add');
    }

    if (nextReadBtn && !nextReadBtn.classList.contains('remove-btn')) {
      setNextReadButtonState(
        nextReadBtn,
        state.nextReadBookIds.has(bookId) ? 'added' : 'add'
      );
    }
  });
};

const refreshSearchResults = () => {
  if (state.lastSearchResults.length > 0) {
    renderBooks(searchResults, state.lastSearchResults, {
      emptyMessage: 'No books matched that search.',
      showAddToLikes: true,
      showAddToNextRead: true,
    });
    syncActionButtonsInContainer(searchResults);
  }
};

const setLikeButtonState = (button, buttonState) => {
  button.classList.remove('liked', 'remove-btn');

  if (buttonState === 'add') {
    button.textContent = '+';
    button.title = 'Add to likes';
    button.setAttribute('aria-label', 'Add to likes');
    button.disabled = false;
    return;
  }

  if (buttonState === 'loading') {
    button.textContent = '…';
    button.title = 'Adding...';
    button.setAttribute('aria-label', 'Adding to likes');
    button.disabled = true;
    return;
  }

  if (buttonState === 'liked') {
    button.textContent = '✓';
    button.title = 'Added to likes';
    button.setAttribute('aria-label', 'Added to likes');
    button.classList.add('liked');
    button.disabled = true;
    return;
  }

  if (buttonState === 'remove') {
    button.textContent = '×';
    button.title = 'Remove from likes';
    button.setAttribute('aria-label', 'Remove from likes');
    button.classList.add('remove-btn');
    button.disabled = false;
  }
};

const setNextReadButtonState = (button, buttonState) => {
  button.classList.remove('added', 'remove-btn');

  if (buttonState === 'add') {
    button.textContent = '→';
    button.title = 'Add to next read';
    button.setAttribute('aria-label', 'Add to next read');
    button.disabled = false;
    return;
  }

  if (buttonState === 'loading') {
    button.textContent = '…';
    button.title = 'Saving...';
    button.setAttribute('aria-label', 'Saving to next read');
    button.disabled = true;
    return;
  }

  if (buttonState === 'added') {
    button.textContent = '✓';
    button.title = 'Added to next read';
    button.setAttribute('aria-label', 'Added to next read');
    button.classList.add('added');
    button.disabled = true;
    return;
  }

  if (buttonState === 'remove') {
    button.textContent = '×';
    button.title = 'Remove from next read';
    button.setAttribute('aria-label', 'Remove from next read');
    button.classList.add('remove-btn');
    button.disabled = false;
  }
};

const setDislikeButtonState = (button, buttonState) => {
  button.classList.remove('loading');

  if (buttonState === 'dislike') {
    button.textContent = '−';
    button.title = 'Not interested';
    button.setAttribute('aria-label', 'Not interested');
    button.disabled = false;
    return;
  }

  if (buttonState === 'loading') {
    button.textContent = '…';
    button.title = 'Saving...';
    button.setAttribute('aria-label', 'Saving preference');
    button.disabled = true;
    button.classList.add('loading');
  }
};

const setRecommendationsLoading = (isLoading) => {
  state.recommendationsLoading = isLoading;
  refreshRecommendations.disabled = isLoading;
  refreshRecommendations.textContent = isLoading && !state.loadingMoreRecommendations
    ? 'Refreshing...'
    : 'Refresh';
  refreshRecommendations.classList.toggle('is-loading', isLoading && !state.loadingMoreRecommendations);

  if (loadMoreRecommendations) {
    loadMoreRecommendations.disabled = isLoading;
    loadMoreRecommendations.textContent = isLoading && state.loadingMoreRecommendations
      ? 'Loading more...'
      : 'Recommend 8 more';
    loadMoreRecommendations.classList.toggle('is-loading', isLoading && state.loadingMoreRecommendations);
  }

  recommendations.classList.toggle('is-loading', isLoading);
};

const updateLoadMoreButton = () => {
  if (!loadMoreRecommendations) {
    return;
  }

  if (!state.token || state.recommendationResults.length === 0 || !state.hasMoreRecommendations) {
    loadMoreRecommendations.classList.add('hidden');
    return;
  }

  loadMoreRecommendations.classList.remove('hidden');
};

const renderRecommendationPanel = () => {
  const emptyMessage = state.seenRecommendationIds.size > 0
    ? 'No new recommendations right now. Like more books to discover additional matches.'
    : 'Like a few books, then refresh to generate ML recommendations.';

  renderBooks(recommendations, state.recommendationResults, {
    showScore: true,
    showReason: true,
    showAddToLikes: true,
    showAddToNextRead: true,
    showRecommendationActions: true,
    showDislike: true,
    emptyMessage,
    panelKey: 'recommendations',
  });
  syncActionButtonsInContainer(recommendations);
  updateLoadMoreButton();
};

const getRecommendationExcludeIds = (append) => {
  if (append) {
    return state.recommendationResults.map((book) => book.id).filter(Boolean);
  }

  return [...state.seenRecommendationIds];
};

const trackSeenRecommendations = (books = []) => {
  books.forEach((book) => {
    if (book?.id) {
      state.seenRecommendationIds.add(book.id);
    }
  });
};

const loadRecommendations = async ({ append = false } = {}) => {
  if (!state.token) {
    return;
  }

  state.loadingMoreRecommendations = append;

  if (!append && state.recommendationResults.length === 0) {
    recommendations.innerHTML = '<p class="empty-state">Refreshing recommendations...</p>';
  }

  setRecommendationsLoading(true);

  try {
    const excludeIds = getRecommendationExcludeIds(append);
    const limit = 8;
    const query = new URLSearchParams({ limit: String(limit) });

    if (excludeIds.length > 0) {
      query.set('exclude', excludeIds.join(','));
    }

    const data = await apiFetch(`/api/user/recommendations?${query.toString()}`);
    const weights = data.weights || { content: 0.6, collaborative: 0.4 };
    const newResults = data.results || [];

    trackSeenRecommendations(newResults);

    state.recommendationResults = append
      ? [...state.recommendationResults, ...newResults]
      : newResults;
    state.hasMoreRecommendations = Boolean(data.hasMore);

    if (append) {
      state.expandedPanels.add('recommendations');
    } else {
      state.expandedPanels.delete('recommendations');
    }

    modelInfo.textContent = data.model
      ? `Model: ${data.model} (${weights.content * 100}% content / ${weights.collaborative * 100}% collaborative)`
      : '';

    renderRecommendationPanel();
  } catch (error) {
    if (!append) {
      recommendations.innerHTML = `<p class="error-message">${error.message}</p>`;
      modelInfo.textContent = '';
      state.recommendationResults = [];
      state.hasMoreRecommendations = false;
      updateLoadMoreButton();
    } else {
      alert(error.message);
    }
  } finally {
    setRecommendationsLoading(false);
    state.loadingMoreRecommendations = false;
    refreshRecommendations.textContent = 'Refresh';
    if (loadMoreRecommendations) {
      loadMoreRecommendations.textContent = 'Recommend 8 more';
    }
  }
};

const removeBookFromRecommendations = (book) => {
  if (!book?.id) {
    return;
  }

  const before = state.recommendationResults.length;
  state.recommendationResults = state.recommendationResults.filter((item) => item.id !== book.id);

  if (state.recommendationResults.length !== before) {
    renderRecommendationPanel();
  }
};

const dislikeBookFromRecommendations = async (book, button) => {
  setDislikeButtonState(button, 'loading');

  try {
    await apiFetch('/api/user/dislike', {
      method: 'POST',
      body: JSON.stringify({ bookId: book.id, book }),
    });

    state.dislikedBookIds.add(book.id);
    removeBookFromRecommendations(book);
  } catch (error) {
    setDislikeButtonState(button, 'dislike');
    alert(error.message);
  }
};

const addBookToLikes = async (book, button) => {
  if (!state.token) {
    redirectToLogin();
    return;
  }

  if (!book?.id) {
    alert('This book cannot be saved because it is missing an ID.');
    return;
  }

  setLikeButtonState(button, 'loading');

  try {
    await apiFetch('/api/user/like', {
      method: 'POST',
      body: JSON.stringify({ bookId: book.id, book }),
    });

    state.likedBookIds.add(book.id);
    setLikeButtonState(button, 'liked');
    removeBookFromRecommendations(book);
    syncActionButtonsInContainer(searchResults);
    syncActionButtonsInContainer(recommendations);
    void refreshListsAfterChange();
  } catch (error) {
    setLikeButtonState(button, 'add');
    alert(error.message);
  }
};

const removeBookFromLikes = async (book, button) => {
  setLikeButtonState(button, 'loading');

  try {
    await apiFetch('/api/user/unlike', {
      method: 'POST',
      body: JSON.stringify({ bookId: book.id }),
    });
    state.likedBookIds.delete(book.id);
    syncActionButtonsInContainer(searchResults);
    syncActionButtonsInContainer(recommendations);
    void refreshListsAfterChange();
  } catch (error) {
    setLikeButtonState(button, 'remove');
    alert(error.message);
  }
};

const fetchNextReadList = async () => {
  try {
    return await apiFetch('/api/user/next-read');
  } catch (error) {
    if (error.message.includes('Not Found') || error.message.includes('Cannot')) {
      return [];
    }
    throw error;
  }
};

const refreshListsAfterChange = async () => {
  try {
    const [likes, nextRead] = await Promise.all([
      apiFetch('/api/user/likes'),
      fetchNextReadList(),
    ]);

    rememberBooks(likes);
    rememberBooks(nextRead);

    state.likedBookIds = new Set(likes.map((book) => book.id).filter(Boolean));
    state.nextReadBookIds = new Set(nextRead.map((book) => book.id).filter(Boolean));

    renderBooks(nextReadBooks, nextRead, {
      emptyMessage: 'Use → on ML recommendations or search results to build your queue.',
      showRemoveFromNextRead: true,
      hideLikeButton: true,
      panelKey: 'nextRead',
    });

    renderBooks(likedBooks, likes, {
      emptyMessage: 'Search for books above, then click + on any result.',
      showUnlike: true,
      hideNextReadButton: true,
      panelKey: 'likes',
    });

    syncActionButtonsInContainer(searchResults);
    syncActionButtonsInContainer(recommendations);
  } catch (error) {
    console.error('Could not refresh lists:', error.message);
  }
};

const addBookToNextRead = async (book, button) => {
  if (!state.token) {
    redirectToLogin();
    return;
  }

  if (!book?.id) {
    alert('This book cannot be saved because it is missing an ID.');
    return;
  }

  setNextReadButtonState(button, 'loading');

  try {
    await apiFetch('/api/user/next-read', {
      method: 'POST',
      body: JSON.stringify({ bookId: book.id, book }),
    });

    state.nextReadBookIds.add(book.id);
    setNextReadButtonState(button, 'added');
    removeBookFromRecommendations(book);
    syncActionButtonsInContainer(searchResults);
    syncActionButtonsInContainer(recommendations);
    void refreshListsAfterChange();
  } catch (error) {
    setNextReadButtonState(button, 'add');
    alert(error.message);
  }
};

const removeBookFromNextRead = async (book, button) => {
  setNextReadButtonState(button, 'loading');

  try {
    await apiFetch('/api/user/next-read/remove', {
      method: 'POST',
      body: JSON.stringify({ bookId: book.id }),
    });
    state.nextReadBookIds.delete(book.id);
    syncActionButtonsInContainer(searchResults);
    syncActionButtonsInContainer(recommendations);
    void refreshListsAfterChange();
  } catch (error) {
    setNextReadButtonState(button, 'remove');
    alert(error.message);
  }
};

const configureCardActions = (book, options, card, dislikeBtn, likeBtn, nextReadBtn) => {
  const showDislike = Boolean(options.showDislike);
  const showLike = Boolean(
    options.showUnlike
    || options.showAddToLikes
    || (state.token && !options.hideLikeButton)
  );

  const showNextRead = !options.hideNextReadButton && Boolean(
    options.showRemoveFromNextRead
    || options.showAddToNextRead
    || (state.token && options.showRecommendationActions)
  );

  if (!showDislike) {
    dislikeBtn.remove();
  }

  if (!showLike) {
    likeBtn.remove();
  }

  if (!showNextRead) {
    nextReadBtn.remove();
  }

  const hasDislikeBtn = card.contains(dislikeBtn);
  const hasLikeBtn = card.contains(likeBtn);
  const hasNextReadBtn = card.contains(nextReadBtn);

  if (showDislike && hasDislikeBtn) {
    setDislikeButtonState(dislikeBtn, 'dislike');
  }

  if (options.showUnlike && hasLikeBtn) {
    setLikeButtonState(likeBtn, 'remove');
  } else if (hasLikeBtn) {
    setLikeButtonState(likeBtn, state.likedBookIds.has(book.id) ? 'liked' : 'add');
  }

  if (options.showRemoveFromNextRead && hasNextReadBtn) {
    setNextReadButtonState(nextReadBtn, 'remove');
  } else if (hasNextReadBtn) {
    setNextReadButtonState(
      nextReadBtn,
      state.nextReadBookIds.has(book.id) ? 'added' : 'add'
    );
  }

  const actionsCorner = card.querySelector('.book-actions-corner');
  if (actionsCorner && !actionsCorner.querySelector('button')) {
    actionsCorner.remove();
  }
};

const formatMlScore = (score) => {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'ML score: —';
  }

  return `ML score: ${Math.round(score * 100)}%`;
};

const createBookCard = (book, options = {}) => {
  const node = bookCardTemplate.content.cloneNode(true);
  const card = node.querySelector('.book-card');
  const cover = node.querySelector('.book-cover');
  const title = node.querySelector('.book-title');
  const authors = node.querySelector('.book-authors');
  const categories = node.querySelector('.book-categories');
  const score = node.querySelector('.book-score');
  const reason = node.querySelector('.book-reason');
  const toggleBtn = node.querySelector('.book-toggle-btn');
  const dislikeBtn = node.querySelector('.dislike-btn');
  const likeBtn = node.querySelector('.like-btn');
  const nextReadBtn = node.querySelector('.next-read-btn');

  rememberBook(book);
  card.dataset.bookId = book.id || '';

  title.textContent = book.title || 'Untitled';
  authors.textContent = book.authors?.length ? book.authors.join(', ') : 'Unknown author';

  if (book.categories?.length) {
    categories.textContent = book.categories.join(' · ');
  } else {
    categories.textContent = 'No categories listed';
    categories.classList.add('muted');
  }

  if (book.thumbnail) {
    cover.src = book.thumbnail;
  } else {
    cover.removeAttribute('src');
    cover.alt = 'No cover available';
  }

  if (options.showScore) {
    score.classList.remove('hidden');
    score.textContent = formatMlScore(book.score);
  } else if (score) {
    score.remove();
  }

  let hasExtraContent = false;

  if (options.showReason && book.reason) {
    reason.classList.remove('hidden');
    reason.textContent = book.reason;
    hasExtraContent = true;
  }

  if (hasExtraContent && toggleBtn) {
    const isExpanded = state.expandedCards.has(book.id);
    card.classList.toggle('is-expanded', isExpanded);
    toggleBtn.classList.remove('hidden');
    toggleBtn.textContent = isExpanded ? 'Show less' : 'Show more';
  } else if (toggleBtn) {
    toggleBtn.remove();
  }

  configureCardActions(book, options, card, dislikeBtn, likeBtn, nextReadBtn);

  return card;
};

const cardHasHiddenContent = (card) => {
  const hasMlDetails = Boolean(card.querySelector('.book-reason:not(.hidden)'));

  const title = card.querySelector('.book-title');
  const authors = card.querySelector('.book-authors');
  const categories = card.querySelector('.book-categories');
  const clampedFields = [title, authors, categories].filter(Boolean);
  const hasClampedText = clampedFields.some(
    (element) => element.scrollHeight > element.clientHeight + 1
  );

  const titleLong = (title?.textContent?.length || 0) > 42;
  const authorsLong = (authors?.textContent?.length || 0) > 36;
  const categoriesLong = Boolean(
    categories
    && !categories.classList.contains('muted')
    && (categories.textContent?.length || 0) > 52
  );

  return hasMlDetails || hasClampedText || titleLong || authorsLong || categoriesLong;
};

const finalizeCardExpand = (card, bookId) => {
  const toggleBtn = card.querySelector('.book-toggle-btn');
  if (!toggleBtn || !bookId) {
    return;
  }

  if (!cardHasHiddenContent(card)) {
    toggleBtn.remove();
    card.classList.remove('is-expanded');
    return;
  }

  const isExpanded = state.expandedCards.has(bookId);
  card.classList.toggle('is-expanded', isExpanded);
  toggleBtn.classList.remove('hidden');
  toggleBtn.textContent = isExpanded ? 'Show less' : 'Show more';
};

const clearBookPanel = (container, message) => {
  container.innerHTML = `<p class="empty-state">${message}</p>`;
  container.classList.remove('is-collapsed');
  state.panelRenderCache.delete(container.id);

  const toggle = document.getElementById(`${container.id}-toggle`);
  if (toggle) {
    toggle.classList.add('hidden');
  }
};

const updateCollapseToggle = (container, books, options) => {
  const panelKey = options.panelKey;
  if (!panelKey) {
    return;
  }

  const toggleId = `${container.id}-toggle`;
  let toggle = document.getElementById(toggleId);

  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = toggleId;
    toggle.className = 'secondary show-toggle-btn';
    toggle.type = 'button';
    container.insertAdjacentElement('afterend', toggle);
    toggle.addEventListener('click', () => {
      if (state.expandedPanels.has(panelKey)) {
        state.expandedPanels.delete(panelKey);
      } else {
        state.expandedPanels.add(panelKey);
      }

      const cached = state.panelRenderCache.get(container.id);
      if (cached) {
        renderBooks(container, cached.books, cached.options);
      }
    });
  }

  if (books.length < COLLAPSE_THRESHOLD) {
    toggle.classList.add('hidden');
    return;
  }

  toggle.classList.remove('hidden');

  if (state.expandedPanels.has(panelKey)) {
    toggle.textContent = 'Show less';
    return;
  }

  const hiddenCount = books.length - COLLAPSE_PREVIEW_COUNT;
  toggle.textContent = `Show more (${hiddenCount} more)`;
};

const renderBooks = (container, books, options = {}) => {
  rememberBooks(books);
  state.panelRenderCache.set(container.id, { books, options });

  if (!books.length) {
    container.innerHTML = `<p class="empty-state">${options.emptyMessage || 'No books to show yet.'}</p>`;
    updateCollapseToggle(container, books, options);
    return;
  }

  const panelKey = options.panelKey;
  const isExpanded = !panelKey || state.expandedPanels.has(panelKey);
  const shouldCollapse = panelKey && books.length >= COLLAPSE_THRESHOLD && !isExpanded;
  const visibleBooks = shouldCollapse ? books.slice(0, COLLAPSE_PREVIEW_COUNT) : books;

  container.innerHTML = '';
  visibleBooks.forEach((book) => {
    const card = createBookCard(book, options);
    container.appendChild(card);
    finalizeCardExpand(card, book.id);
  });

  if (panelKey) {
    container.classList.toggle('is-collapsed', shouldCollapse);
  }

  updateCollapseToggle(container, books, options);
};

const loadUserData = async () => {
  if (!state.token) {
    clearBookPanel(nextReadBooks, 'Log in to build your next read list.');
    clearBookPanel(likedBooks, 'Log in to track likes and get recommendations.');
    return;
  }

  try {
    const [likes, nextRead] = await Promise.all([
      apiFetch('/api/user/likes'),
      fetchNextReadList(),
    ]);

    state.likedBookIds = new Set(likes.map((book) => book.id));
    state.nextReadBookIds = new Set(nextRead.map((book) => book.id));

    renderBooks(nextReadBooks, nextRead, {
      emptyMessage: 'Use → on ML recommendations or search results to build your queue.',
      showRemoveFromNextRead: true,
      hideLikeButton: true,
      panelKey: 'nextRead',
    });

    renderBooks(likedBooks, likes, {
      emptyMessage: 'Search for books above, then click + on any result.',
      showUnlike: true,
      hideNextReadButton: true,
      panelKey: 'likes',
    });

    await loadRecommendations();
    refreshSearchResults();
  } catch (error) {
    if (error.message.includes('Database is waking up')) {
      clearBookPanel(nextReadBooks, error.message);
      clearBookPanel(likedBooks, error.message);
      clearBookPanel(recommendations, error.message);
      return;
    }

    if (error.message.includes('Not authorized') || error.message.includes('token failed')) {
      state.token = '';
      state.email = '';
      state.likedBookIds = new Set();
      state.nextReadBookIds = new Set();
      state.dislikedBookIds = new Set();
      state.recommendationResults = [];
      state.seenRecommendationIds = new Set();
      state.hasMoreRecommendations = false;
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      renderAuthPanel();
      clearBookPanel(nextReadBooks, 'Log in to build your next read list.');
      clearBookPanel(likedBooks, 'Log in to track likes and get recommendations.');
      clearBookPanel(recommendations, 'Like a few books to train the recommender.');
      modelInfo.textContent = '';
      return;
    }

    likedBooks.innerHTML = `<p class="error-message">${error.message}</p>`;
  }
};

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (!query) {
    return;
  }

  searchResults.innerHTML = '<p class="empty-state">Searching...</p>';

  try {
    const data = await apiFetch(`/api/books/search?q=${encodeURIComponent(query)}`);
    state.lastSearchResults = data.results;
    renderBooks(searchResults, data.results, {
      emptyMessage: 'No books matched that search.',
      showAddToLikes: true,
      showAddToNextRead: true,
    });
    syncActionButtonsInContainer(searchResults);
  } catch (error) {
    searchResults.innerHTML = `<p class="error-message">${error.message}</p>`;
  }
});

refreshRecommendations.addEventListener('click', () => {
  void loadRecommendations();
});

if (scoreHelpBtn && scoreHelpPanel) {
  scoreHelpBtn.addEventListener('click', () => {
    const isHidden = scoreHelpPanel.classList.toggle('hidden');
    scoreHelpBtn.textContent = isHidden ? 'What is the score?' : 'Hide score info';
    scoreHelpBtn.setAttribute('aria-expanded', String(!isHidden));
  });
}

if (loadMoreRecommendations) {
  loadMoreRecommendations.addEventListener('click', () => {
    void loadRecommendations({ append: true });
  });
}

document.addEventListener('click', (event) => {
  const toggleBtn = event.target.closest('.book-toggle-btn');
  if (toggleBtn) {
    const card = toggleBtn.closest('.book-card');
    const bookId = card?.dataset?.bookId;

    if (!bookId) {
      return;
    }

    if (state.expandedCards.has(bookId)) {
      state.expandedCards.delete(bookId);
      card.classList.remove('is-expanded');
      toggleBtn.textContent = 'Show more';
    } else {
      state.expandedCards.add(bookId);
      card.classList.add('is-expanded');
      toggleBtn.textContent = 'Show less';
    }
    return;
  }

  if (!event.target.closest(ACTION_CONTAINERS)) {
    return;
  }

  const dislikeBtn = event.target.closest('.dislike-btn');
  const likeBtn = event.target.closest('.like-btn');
  const nextReadBtn = event.target.closest('.next-read-btn');

  if (!dislikeBtn && !likeBtn && !nextReadBtn) {
    return;
  }

  const button = dislikeBtn || likeBtn || nextReadBtn;
  if (button.disabled) {
    return;
  }

  const card = button.closest('.book-card');
  const bookId = card?.dataset?.bookId;
  const book = bookId ? state.booksById.get(bookId) : null;

  if (!book) {
    alert('This book cannot be saved because it is missing an ID.');
    return;
  }

  if (dislikeBtn) {
    void dislikeBookFromRecommendations(book, dislikeBtn);
    return;
  }

  if (likeBtn) {
    if (likeBtn.classList.contains('remove-btn')) {
      void removeBookFromLikes(book, likeBtn);
      return;
    }

    if (!likeBtn.classList.contains('liked')) {
      void addBookToLikes(book, likeBtn);
    }
    return;
  }

  if (nextReadBtn.classList.contains('remove-btn')) {
    void removeBookFromNextRead(book, nextReadBtn);
    return;
  }

  if (!nextReadBtn.classList.contains('added')) {
    void addBookToNextRead(book, nextReadBtn);
  }
});

renderAuthPanel();
if (state.token) {
  loadUserData();
} else {
  clearBookPanel(nextReadBooks, 'Log in to build your next read list.');
  clearBookPanel(likedBooks, 'Log in to track likes and get recommendations.');
  clearBookPanel(recommendations, 'Like a few books to train the recommender.');
}
