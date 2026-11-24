import { MemoryDraftStore } from './memoryDraftStore';
import { describeDraftStoreContract } from './draftStoreContract';

describeDraftStoreContract('MemoryDraftStore', () => new MemoryDraftStore());