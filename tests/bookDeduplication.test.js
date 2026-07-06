const {
  getBookRelation,
  shouldExcludeFromRecommendations,
  filterRecommendationCandidates,
  isEditionVariant,
  isBundleOrCollection,
  getCoreTitle,
} = require('../src/utils/bookDeduplication');

describe('book deduplication', () => {
  const dune = {
    id: 'liked-1',
    title: 'Dune',
    authors: ['Frank Herbert'],
    categories: ['Science Fiction'],
  };

  it('flags edition variants such as movie tie-ins', () => {
    expect(isEditionVariant('Dune: Official Movie Tie-In')).toBe(true);
    expect(isEditionVariant('Dune Messiah')).toBe(false);
  });

  it('flags collections, trilogies, and box sets', () => {
    expect(isBundleOrCollection('The Great Dune Trilogy')).toBe(true);
    expect(isBundleOrCollection('Dune Boxed Set')).toBe(true);
    expect(isBundleOrCollection('Dune: Books 1-3')).toBe(true);
    expect(isBundleOrCollection('The Dune Series')).toBe(true);
    expect(isBundleOrCollection('Dune Messiah')).toBe(false);
  });

  it('treats duplicate editions of liked books as duplicates', () => {
    const movieEdition = {
      id: 'candidate-1',
      title: 'Dune: Official Movie Tie-In',
      authors: ['Frank Herbert'],
    };

    expect(getBookRelation(dune, movieEdition)).toBe('duplicate');
    expect(shouldExcludeFromRecommendations(movieEdition, [dune])).toBe(true);
  });

  it('rejects the same book with a different id', () => {
    const sameBook = {
      id: 'ol-dune-different-id',
      title: 'Dune',
      authors: ['Frank Herbert'],
    };

    expect(shouldExcludeFromRecommendations(sameBook, [dune])).toBe(true);
  });

  it('rejects bundles related to liked books', () => {
    const trilogy = {
      id: 'candidate-2',
      title: 'The Great Dune Trilogy',
      authors: ['Frank Herbert'],
    };

    expect(getBookRelation(dune, trilogy)).toBe('bundle');
    expect(shouldExcludeFromRecommendations(trilogy, [dune])).toBe(true);
  });

  it('keeps individual sequels as separate books', () => {
    const sequel = {
      id: 'candidate-3',
      title: 'Dune Messiah',
      authors: ['Frank Herbert'],
    };

    expect(getBookRelation(dune, sequel)).toBe('sequel');
    expect(shouldExcludeFromRecommendations(sequel, [dune])).toBe(false);
  });

  it('removes duplicate editions and bundles while keeping distinct books', () => {
    const candidates = [
      { id: '1', title: 'Dune', authors: ['Frank Herbert'] },
      { id: '2', title: 'Dune: Film Tie-In', authors: ['Frank Herbert'] },
      { id: '3', title: 'The Great Dune Trilogy', authors: ['Frank Herbert'] },
      { id: '4', title: 'Dune Messiah', authors: ['Frank Herbert'] },
      { id: '5', title: 'Neuromancer', authors: ['William Gibson'] },
      { id: '6', title: 'Neuromancer', authors: ['William Gibson'] },
    ];

    const filtered = filterRecommendationCandidates(candidates, [dune]);

    expect(filtered.map((book) => book.id)).toEqual(['4', '5']);
  });

  it('rejects books already in next read', () => {
    const nextReadBook = {
      id: 'next-1',
      title: 'Hyperion',
      authors: ['Dan Simmons'],
    };
    const sameBook = {
      id: 'ol-hyperion-different-id',
      title: 'Hyperion',
      authors: ['Dan Simmons'],
    };

    expect(shouldExcludeFromRecommendations(sameBook, [nextReadBook])).toBe(true);
  });

  it('blocks another copy of a liked core title in the candidate pool', () => {
    const candidates = [
      { id: '10', title: 'Dune', authors: ['Frank Herbert', 'Someone Else'] },
      { id: '11', title: 'Hyperion', authors: ['Dan Simmons'] },
    ];

    const filtered = filterRecommendationCandidates(candidates, [dune]);
    expect(filtered.map((book) => book.id)).toEqual(['11']);
    expect(getCoreTitle('Dune')).toBe('dune');
  });
});
