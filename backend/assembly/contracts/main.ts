// The entry file of your WebAssembly module.
import { Context, generateEvent, Storage } from '@massalabs/massa-as-sdk';
import { Args, stringToBytes } from '@massalabs/as-types';

const SCRIPT_ID_KEY = 'script_id';

/**
 * This function is meant to be called only one time: when the contract is deployed.
 *
 * @param binaryArgs - Arguments serialized with Args
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());
  if (!Storage.has(SCRIPT_ID_KEY)) {
    Storage.set(SCRIPT_ID_KEY, '0');
  }
}

/**
 * Save a script with a given script_id.
 * @param binaryArgs - Args: [script: string, script_id: u64]
 */
export function save_script(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const scriptId = args.nextU64().expect('Script ID argument missing or invalid');
  const script = args.nextString().expect('Script argument missing or invalid');
  
  assert(Storage.has(SCRIPT_ID_KEY), `Script ID not set`);
  const nextScriptId = parseInt(Storage.get(SCRIPT_ID_KEY)) as u64;
  if (scriptId >= nextScriptId) {
    assert(scriptId === nextScriptId, `Script ID ${scriptId} is not consecutive to ${nextScriptId}`);
    // Update the last saved script_id
    Storage.set(SCRIPT_ID_KEY, (scriptId + 1).toString());
  }
  // Store the script with key: scripts_{script_id}
  const scriptKey = `scripts_${scriptId.toString()}`;
  Storage.set(scriptKey, script);
  
  generateEvent(`Script saved with ID ${scriptId.toString()}: ${script}`);
}

/**
 * Get a saved script by script_id.
 * @param binaryArgs - Args: [script_id: u64]
 * @returns the saved script serialized in bytes
 */
export function get_saved_script(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const scriptId = args.nextU64().expect('Script ID argument missing or invalid');
  
  const scriptKey = `scripts_${scriptId.toString()}`;
  assert(Storage.has(scriptKey), 'Script not found');
  
  const script = Storage.get(scriptKey);
  generateEvent(`Retrieved script with ID ${scriptId.toString()}: ${script}`);
  return stringToBytes(script);
}

/**
 * Get the last saved script_id.
 * @param _ - not used
 * @returns the last script_id serialized in bytes
 */
export function get_script_id(_: StaticArray<u8>): StaticArray<u8> {
  assert(Storage.has(SCRIPT_ID_KEY), 'Script ID not set');
  const scriptId = Storage.get(SCRIPT_ID_KEY);
  generateEvent(`Retrieved last script ID: ${scriptId}`);
  return stringToBytes(scriptId);
}
