import { MemoryRepository } from './memoryRepository';
import { describeRepositoryContract } from './repositoryContract';

describeRepositoryContract('MemoryRepository', () => new MemoryRepository());