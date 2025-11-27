import type { HashAlgorithm, HashWeights, MediaInput, SearchInput } from '../types';

const VALID_HASH_ALGORITHMS: HashAlgorithm[] = ['phash', 'dhash', 'ahash', 'colorHash'];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateMediaInput(input: MediaInput): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Media input must be an object');
  }

  if (input.source === undefined || input.source === null) {
    throw new ValidationError('Media input must have a source');
  }

  if (input.type !== undefined && input.type !== 'image' && input.type !== 'video') {
    throw new ValidationError('Media type must be "image" or "video"');
  }

  if (input.id !== undefined && typeof input.id !== 'string') {
    throw new ValidationError('Media ID must be a string');
  }

  if (input.id !== undefined && input.id.length === 0) {
    throw new ValidationError('Media ID cannot be empty');
  }

  if (input.metadata !== undefined && typeof input.metadata !== 'object') {
    throw new ValidationError('Metadata must be an object');
  }
}

export function validateSearchInput(input: SearchInput): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Search input must be an object');
  }

  if (input.source === undefined || input.source === null) {
    throw new ValidationError('Search input must have a source');
  }

  if (typeof input.threshold !== 'number') {
    throw new ValidationError('Threshold must be a number');
  }

  if (input.threshold < 0 || input.threshold > 64) {
    throw new ValidationError('Threshold must be between 0 and 64');
  }

  if (input.hashAlgorithm !== undefined && !VALID_HASH_ALGORITHMS.includes(input.hashAlgorithm)) {
    throw new ValidationError(
      `Invalid hash algorithm: ${input.hashAlgorithm}. Valid options: ${VALID_HASH_ALGORITHMS.join(', ')}`
    );
  }

  if (input.weights !== undefined) {
    validateHashWeights(input.weights);
  }

  if (input.limit !== undefined) {
    if (typeof input.limit !== 'number' || input.limit < 1) {
      throw new ValidationError('Limit must be a positive number');
    }
  }
}

export function validateHashWeights(weights: HashWeights): void {
  if (typeof weights !== 'object') {
    throw new ValidationError('Weights must be an object');
  }

  let totalWeight = 0;

  for (const [algo, weight] of Object.entries(weights)) {
    if (!VALID_HASH_ALGORITHMS.includes(algo as HashAlgorithm)) {
      throw new ValidationError(`Invalid hash algorithm in weights: ${algo}`);
    }

    if (typeof weight !== 'number') {
      throw new ValidationError(`Weight for ${algo} must be a number`);
    }

    if (weight < 0 || weight > 1) {
      throw new ValidationError(`Weight for ${algo} must be between 0 and 1`);
    }

    totalWeight += weight;
  }

  // Allow some floating point tolerance
  if (Math.abs(totalWeight - 1) > 0.001 && totalWeight > 0) {
    // weights don't need to sum to 1, they'll be normalized
    // this is just a warning scenario, not an error
  }
}

export function validateHashAlgorithms(algorithms: HashAlgorithm[]): void {
  if (!Array.isArray(algorithms)) {
    throw new ValidationError('Hash algorithms must be an array');
  }

  if (algorithms.length === 0) {
    throw new ValidationError('At least one hash algorithm must be specified');
  }

  for (const algo of algorithms) {
    if (!VALID_HASH_ALGORITHMS.includes(algo)) {
      throw new ValidationError(
        `Invalid hash algorithm: ${algo}. Valid options: ${VALID_HASH_ALGORITHMS.join(', ')}`
      );
    }
  }
}

export function validateRedisConnection(connection: string): void {
  if (typeof connection !== 'string') {
    throw new ValidationError('Redis connection must be a string');
  }

  if (connection.length === 0) {
    throw new ValidationError('Redis connection string cannot be empty');
  }

  if (!connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
    throw new ValidationError('Redis connection must start with redis:// or rediss://');
  }
}
