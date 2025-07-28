import { useState, useEffect } from 'react';
import { getWallets } from '@massalabs/wallet-provider';
import { bytesToStr, JsonRPCClient, SmartContract, Args } from '@massalabs/massa-web3';
import './App.css';

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [scripts, setScripts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<any>(null);

  const sc_addr = "AS12PxxbGQStacZMs2R8tuHyoQBJu6zjD9JHrRNM3GazKYmUmUisq";

  // Get the next script ID from datastore
  async function getNextScriptId(): Promise<number> {
    if (!sc_addr) {
      console.log('No contract address found, returning 0');
      return 0;
    }
    try {
      const client = JsonRPCClient.buildnet();
      const dataStoreVal = await client.getDatastoreEntry('script_id', sc_addr, false);
      console.log('Data store value:', dataStoreVal);
      if (!dataStoreVal) {
        console.log('No script_id found in datastore, returning 0');
        return 0;
      }
      const nextId = bytesToStr(dataStoreVal);
      console.log('Next script ID from datastore:', nextId);
      return parseInt(nextId) || 0;
    } catch (e) {
      console.error('Error getting next script ID:', e);
      return 0;
    }
  }

  // Get a specific script by ID from datastore
  async function getScriptById(scriptId: number): Promise<string | null> {
    if (!sc_addr) return null;
    
    try {
      const client = JsonRPCClient.buildnet();
      const key = `scripts_${scriptId}`;
      const dataStoreVal = await client.getDatastoreEntry(key, sc_addr, false);
      if (!dataStoreVal) {
        console.log(`No script found for ID ${scriptId}`);
        return null;
      }
      const script = bytesToStr(dataStoreVal);
      console.log(`Script ${scriptId} from datastore:`, script);
      return script;
    } catch (e) {
      console.error(`Error getting script ${scriptId}:`, e);
      return null;
    }
  }

  // Fetch all scripts from smart contract
  async function fetchScripts() {
    if (!sc_addr) return;
    
    console.log('fetchScripts called with sc_addr:', sc_addr);
    
    setLoading(true);
    setError(null);
    try {
      // Get the next script ID
      const nextId = await getNextScriptId();
      
      if (nextId === 0) {
        console.log('No scripts found (nextId is 0)');
        setScripts([]);
        return;
      }
      
      // Fetch all scripts from ID 0 to nextId
      const scriptPromises = [];
      for (let i = 0; i <= nextId; i++) {
        scriptPromises.push(getScriptById(i));
      }
      
      const scriptResults = await Promise.all(scriptPromises);
      const validScripts = scriptResults.filter((script): script is string => script !== null);
      
      console.log('All scripts fetched:', validScripts);
      setScripts(validScripts);
      
    } catch (e) {
      setError("Failed to fetch scripts.");
      console.error("Error fetching scripts:", e);
    } finally {
      setLoading(false);
    }
  }

  // Save script to smart contract
  async function saveScript() {
    if (!walletAddress || !sc_addr || !inputText.trim() || !account) return;
    
    console.log('saveScript called with:', { 
      walletAddress, 
      sc_addr, 
      inputText: inputText.trim(),
      hasAccount: !!account
    });
    
    setSaving(true);
    setError(null);
    try {
      // Get the next script ID
      const nextId = await getNextScriptId();
      
      console.log('Saving script with ID:', nextId);
      
      // Check account balance before saving
      const balance = await account.balance(false);
      console.log('Account balance before save:', balance.toString(), 'MAS');
      
      // Create SmartContract instance with the account as provider
      const contract = new SmartContract(account, sc_addr);

      // Prepare arguments for the save_script function
      const args = new Args().addU64(BigInt(nextId)).addString(inputText.trim());
      console.log('Sending args to contract:', { script: inputText.trim(), nextId: nextId });

      // Call the smart contract's save_script function
      const result = await contract.call('save_script', args);
      console.log('Contract call result:', result);

      // Wait for the operation to be finalized
      await result.waitFinalExecution();
      console.log('Operation finalized');
      
      // Clear input and refresh scripts
      setInputText("");
      await fetchScripts();
      
    } catch (e) {
      setError("Failed to save script.");
      console.error("Error saving script:", e);
    } finally {
      setSaving(false);
    }
  }

  // Fetch scripts when wallet connects
  useEffect(() => {
    console.log('useEffect triggered - walletAddress changed to:', walletAddress);
    if (walletAddress) {
      console.log('Calling fetchScripts from useEffect');
      fetchScripts();
    }
  }, [walletAddress]);

  async function connectWallet() {
    setError(null);
    try {
      console.log('Connecting to wallet...');
      const wallets = await getWallets();
      console.log('Available wallets:', wallets.length);
      
      if (wallets.length === 0) {
        setError("No wallets found");
        return;
      }
      const wallet = wallets[0];
      console.log('Using wallet:', wallet.name());
      
      const connected = await wallet.connect();
      console.log('Wallet connected:', connected);
      
      if (!connected) {
        setError("Failed to connect to wallet");
        return;
      }
      const accounts = await wallet.accounts();
      console.log('Wallet accounts:', accounts);
      
      if (accounts.length === 0) {
        setError("No accounts found in wallet");
        return;
      }
      
      // Initialize client from wallet account
      const account = accounts[0];
      console.log('Using account:', account.address);
      
      // Check account balance
      try {
        const balance = await account.balance(false);
        console.log('Account balance:', balance.toString(), 'MAS');
      } catch (balanceError) {
        console.error('Error getting balance:', balanceError);
      }
      
      setAccount(account);
      
      setWalletAddress(accounts[0].address);
      wallet.listenAccountChanges((address) => {
        console.log('Account changed to:', address);
        setWalletAddress(address);
      });
    } catch (e) {
      setError("Error connecting to wallet");
      console.error("Error in connectWallet:", e);
    }
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <button className="wallet-btn" style={{ marginLeft: 'auto' }} onClick={connectWallet}>
          {walletAddress ? walletAddress.slice(0, 8) + "..." : "Connect Wallet"}
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
      
      <div className="main-content">
        <div className="sidebar-hover-area"
             onMouseEnter={() => setSidebarVisible(true)}
             onMouseLeave={() => setSidebarVisible(false)}>
          <div className={`sidebar-toggle ${sidebarVisible ? 'moved' : ''}`}>
            <div className="toggle-icon">☰</div>
          </div>
          
          <div className={`sidebar ${sidebarVisible ? 'visible' : ''}`}>
            <h3>Your Scripts</h3>
            <div className="scripts-list">
              {loading ? (
                <div className="script-item">Loading...</div>
              ) : scripts.length === 0 ? (
                <div className="script-item">No scripts yet.</div>
              ) : (
                scripts.map((script, index) => (
                  <div key={index} className="script-item">
                    {script}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="content-area">
          {/* Main content area - empty for now */}
        </div>
      </div>
      
      <div className="bottom-bar">
        <input
          className="text-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your script..."
          disabled={!walletAddress || saving}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !saving && inputText.trim()) {
              saveScript();
            }
          }}
        />
        <button 
          className="save-btn" 
          onClick={saveScript}
          disabled={!walletAddress || !inputText.trim() || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default App;



