const EDITION_PHRASES = /movie tie[- ]?in|film tie[- ]?in|media tie[- ]?in|official movie|novelization|study guide|sparknotes|summary and analysis|illustrated edition|graphic novel adaptation|colouring book|coloring book|cliffsnotes|book analysis|reading guide|workbook|teacher guide|a novel\b|special edition/i;

const COLLECTION_PHRASES = /box(?:ed)?\s*set|\bomnibus\b|\btrilogy\b|\bduology\b|\btetralogy\b|\bpentalogy\b|\b(?:book|novel)s?\s+collection\b|\bcomplete\s+(?:works|series|collection|edition)\b|\bcollected\s+(?:works|stories|novels|edition)\b|\b(?:deluxe|collector'?s|anniversary|gift)\s+edition\b|\b(?:paperback|hardcover)\s+set\b|\bseries\s+collection\b|\bcompanion\s+volume\b|bind[- ]?up|bindup|\bset\s+of\s+\d+|\b\d+\s*[-–]\s*\d+\b|\bbooks?\s+\d+\s*[-–]\s*\d+|\bvolumes?\s+\d+\s*[-–]\s*\d+|\ball\s+\d+\s+books?|\b(?:three|four|five|six|seven|eight)[\s-](?:book|novel|volume)\b|\b(?:three|four|five|six|seven|eight)\s+books?\b|\bin\s+one\s+volume\b|\b2[\s-]in[\s-]1\b|\b3[\s-]in[\s-]1\b|\bgreat\s+.+\s+trilogy\b|\b\w+\s+series\b/i;

const SEQUEL_INDICATORS = /\b(?:part|book|volume|vol)\s*(?:ii|iii|iv|v|2|3|4|5|two|three|four|five)\b|\b(?:messiah|ascendent|ascension|legacy|returns|awakens|son of|daughter of|heir to|prequel|sequel|origins|beginning|finale|conclusion|house|chapter|rising|awakening|reborn|rebirth|empire|exile|war|shadow|daughter|brother|sister)\b/i;

const EDITION_SUFFIX = /^(?:complete|omnibus|collection|collected|box|boxed|deluxe|anniversary|illustrated|young adult|special|expanded|tie[- ]?in|movie|film|media|official|classic|definitive|unabridged|abridged|annotated|revised|updated|remastered)/;

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'at', 'for', 'with']);

const normalizeForMatch = (value = '') => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getPrimaryAuthor = (authors = []) => normalizeForMatch(authors[0] || '');

const authorsLikelyMatch = (authorsA = [], authorsB = []) => {
  const primaryA = getPrimaryAuthor(authorsA);
  const primaryB = getPrimaryAuthor(authorsB);

  if (!primaryA || !primaryB) {
    return true;
  }

  if (primaryA === primaryB) {
    return true;
  }

  return primaryA.includes(primaryB) || primaryB.includes(primaryA);
};

const stripEditionNoise = (title = '') => {
  let cleaned = title.replace(/\([^)]*\)/g, ' ');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  cleaned = cleaned.replace(EDITION_PHRASES, ' ');
  cleaned = cleaned.replace(COLLECTION_PHRASES, ' ');
  return normalizeForMatch(cleaned);
};

const getCoreTitle = (title = '') => {
  const colonIndex = title.indexOf(':');

  if (colonIndex > 0) {
    const beforeColon = stripEditionNoise(title.slice(0, colonIndex));
    const afterColon = title.slice(colonIndex + 1);
    const afterNormalized = stripEditionNoise(afterColon);

    if (
      EDITION_PHRASES.test(afterColon)
      || COLLECTION_PHRASES.test(afterColon)
      || EDITION_SUFFIX.test(afterNormalized)
    ) {
      return beforeColon;
    }

    if (SEQUEL_INDICATORS.test(afterColon) && !COLLECTION_PHRASES.test(afterColon)) {
      return stripEditionNoise(title);
    }

    if (afterNormalized.split(' ').filter(Boolean).length <= 3 && !SEQUEL_INDICATORS.test(afterColon)) {
      return beforeColon;
    }

    return beforeColon || stripEditionNoise(title);
  }

  return stripEditionNoise(title);
};

const getTitleTokens = (title = '') => {
  return getCoreTitle(title)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
};

const getTitleSimilarity = (titleA = '', titleB = '') => {
  const tokensA = new Set(getTitleTokens(titleA));
  const tokensB = new Set(getTitleTokens(titleB));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(tokensA.size, tokensB.size);
};

const getBookFingerprint = (book) => `${getCoreTitle(book.title)}::${getPrimaryAuthor(book.authors)}`;

const isEditionVariant = (title = '') => EDITION_PHRASES.test(title);

const isBundleOrCollection = (title = '') => COLLECTION_PHRASES.test(title);

const isSingleBookSequel = (title = '') => (
  SEQUEL_INDICATORS.test(title) && !isBundleOrCollection(title)
);

const getBookRelation = (referenceBook, candidateBook) => {
  if (isBundleOrCollection(candidateBook.title)) {
    return 'bundle';
  }

  if (isEditionVariant(candidateBook.title)) {
    return 'duplicate';
  }

  if (!authorsLikelyMatch(referenceBook.authors, candidateBook.authors)) {
    return 'different';
  }

  const referenceCore = getCoreTitle(referenceBook.title);
  const candidateCore = getCoreTitle(candidateBook.title);

  if (!referenceCore || !candidateCore) {
    return 'different';
  }

  if (referenceCore === candidateCore) {
    return 'duplicate';
  }

  const referenceTokens = getTitleTokens(referenceBook.title);
  const candidateTokens = getTitleTokens(candidateBook.title);

  if (referenceTokens.length <= 2) {
    const sharedLead = referenceTokens[0] && candidateTokens[0] === referenceTokens[0];
    if (sharedLead && !isSingleBookSequel(candidateBook.title)) {
      if (getTitleSimilarity(referenceBook.title, candidateBook.title) >= 0.5) {
        return 'duplicate';
      }
    }
  }

  const titleSimilarity = getTitleSimilarity(referenceBook.title, candidateBook.title);
  if (titleSimilarity >= 0.72 && !isSingleBookSequel(candidateBook.title)) {
    return 'duplicate';
  }

  if (candidateCore.startsWith(`${referenceCore} `) || candidateCore.startsWith(referenceCore)) {
    const suffix = candidateCore.slice(referenceCore.length).trim();

    if (!suffix) {
      return 'duplicate';
    }

    if (isBundleOrCollection(candidateBook.title) || COLLECTION_PHRASES.test(suffix)) {
      return 'bundle';
    }

    if (SEQUEL_INDICATORS.test(candidateBook.title) || SEQUEL_INDICATORS.test(suffix)) {
      return 'sequel';
    }

    if (EDITION_SUFFIX.test(suffix) || suffix.split(' ').filter(Boolean).length <= 2) {
      return 'duplicate';
    }

    return 'sequel';
  }

  if (referenceCore.startsWith(candidateCore) && candidateCore.length >= 4) {
    return 'bundle';
  }

  return 'different';
};

const isSameWorkAsReference = (candidate, referenceBook) => {
  const relation = getBookRelation(referenceBook, candidate);
  return relation === 'duplicate' || relation === 'bundle';
};

const shouldExcludeFromRecommendations = (candidate, excludedBooks = []) => {
  if (!candidate?.id || !candidate?.title) {
    return true;
  }

  if (isBundleOrCollection(candidate.title) || isEditionVariant(candidate.title)) {
    return true;
  }

  return excludedBooks.some((referenceBook) => isSameWorkAsReference(candidate, referenceBook));
};

const filterRecommendationCandidates = (candidates = [], excludedBooks = []) => {
  const seenFingerprints = new Set();
  const seenCores = new Set(
    excludedBooks.map((book) => getCoreTitle(book.title)).filter(Boolean)
  );

  return candidates.filter((candidate) => {
    if (shouldExcludeFromRecommendations(candidate, excludedBooks)) {
      return false;
    }

    const fingerprint = getBookFingerprint(candidate);
    if (seenFingerprints.has(fingerprint)) {
      return false;
    }

    const candidateCore = getCoreTitle(candidate.title);
    if (candidateCore && seenCores.has(candidateCore) && !isSingleBookSequel(candidate.title)) {
      return false;
    }

    seenFingerprints.add(fingerprint);
    return true;
  });
};

module.exports = {
  COLLECTION_PHRASES,
  EDITION_PHRASES,
  getBookFingerprint,
  getBookRelation,
  getCoreTitle,
  getTitleSimilarity,
  isBundleOrCollection,
  isEditionVariant,
  isSameWorkAsReference,
  shouldExcludeFromRecommendations,
  filterRecommendationCandidates,
};
