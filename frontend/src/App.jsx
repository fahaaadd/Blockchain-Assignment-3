import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import SupplyChainABI from "./SupplyChainABI.json";
import deploymentInfo from "./deploymentInfo.json";
import "./App.css";

const CONTRACT_ADDRESS = deploymentInfo.contractAddress;
const ROLES      = { 0:"None", 1:"Manufacturer", 2:"Distributor", 3:"Retailer", 4:"Customer" };
const ROLE_ICONS = { 0:"⬜", 1:"🏭", 2:"🚚", 3:"🏪", 4:"👤" };
const ROLE_CLR   = { 1:"#4ade80", 2:"#60a5fa", 3:"#f472b6", 4:"#fb923c" };
const STATUSES   = ["Manufactured","Sent to Distributor","Received by Distributor","Sent to Retailer","Received by Retailer","Sold to Customer","Delivered"];
const S_ICONS    = ["🏭","🚚","📦","🚛","🏪","💳","✅"];
const short = a => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "—";
const fmtTs = ts => new Date(Number(ts)*1000).toLocaleString();

export default function App() {
  const [prov, setProv]         = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount]   = useState("");
  const [myRole, setMyRole]     = useState(0);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory]   = useState([]);
  const [tab, setTab]           = useState("products");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ text:"", type:"" });
  const [newProd, setNewProd]   = useState({ name:"", desc:"" });
  const [regP, setRegP]         = useState({ addr:"", role:"2", name:"" });
  const [target, setTarget]     = useState("");

  const notify = (text, type="success") => { setMsg({text,type}); setTimeout(()=>setMsg({text:"",type:""}),5000); };

  // ── Connect & reload role when MetaMask switches accounts ──────────────
  const loadRole = async (_contract, _account) => {
    const p = await _contract.getParticipant(_account);
    setMyRole(Number(p.role));
  };

  const connect = async () => {
    if (!window.ethereum) { notify("MetaMask not found!","error"); return; }
    setLoading(true);
    try {
      const _prov    = new ethers.BrowserProvider(window.ethereum);
      await _prov.send("eth_requestAccounts",[]);
      const _signer  = await _prov.getSigner();
      const _account = await _signer.getAddress();
      const _contract= new ethers.Contract(CONTRACT_ADDRESS, SupplyChainABI, _signer);
      setProv(_prov); setAccount(_account); setContract(_contract);
      await loadRole(_contract, _account);
    } catch(e){ notify(e.message,"error"); }
    finally { setLoading(false); }
  };

  // Auto-detect MetaMask account switch
  useEffect(() => {
    if (!window.ethereum) return;
    const onChange = async (accs) => {
      if (!accs.length || !prov) return;
      const _signer  = await prov.getSigner(accs[0]);
      const _account = await _signer.getAddress();
      const _contract= new ethers.Contract(CONTRACT_ADDRESS, SupplyChainABI, _signer);
      setAccount(_account); setContract(_contract);
      await loadRole(_contract, _account);
      notify(`Switched to ${short(_account)} — ${ROLES[myRole]}`);
    };
    window.ethereum.on("accountsChanged", onChange);
    return () => window.ethereum.removeListener("accountsChanged", onChange);
  }, [prov]);

  // ── Products ───────────────────────────────────────────────────────────
  const loadProds = useCallback(async () => {
    if (!contract) return;
    const ids = await contract.getAllProductIds();
    const ps  = await Promise.all(ids.map(async id => {
      const p = await contract.getProduct(id);
      return { id:Number(p.id), name:p.name, desc:p.description,
               owner:p.currentOwner, status:Number(p.status), ts:Number(p.createdAt) };
    }));
    setProducts(ps);
  }, [contract]);

  useEffect(()=>{ loadProds(); },[loadProds]);

  const loadHist = async (id) => {
    const h = await contract.getProductHistory(id);
    setHistory(h.map(e=>({ actor:e.actor, role:Number(e.actorRole),
      status:Number(e.status), ts:Number(e.timestamp), note:e.note })));
  };

  const pick = async (p) => { setSelected(p); await loadHist(p.id); setTab("detail"); };

  // ── Tx helper ─────────────────────────────────────────────────────────
  const tx = async (fn, ok) => {
    setLoading(true);
    try {
      const t = await fn(); notify(`⏳ ${t.hash.slice(0,18)}…`,"info");
      await t.wait(); notify(`✅ ${ok}`);
      await loadProds();
      if (selected) await loadHist(selected.id);
    } catch(e){ notify(e.reason||e.message,"error"); }
    finally { setLoading(false); }
  };

  const isOwner = p => p?.owner?.toLowerCase() === account.toLowerCase();

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* Header */}
      <header className="hdr">
        <div className="hdr-l">
          <span className="logo">⛓️</span>
          <div><h1>ChainTrack</h1><p className="sub">By <strong>Fahad Saleem 22L-6568</strong></p></div>
        </div>
        {account
          ? <div className="chip" style={{borderColor:ROLE_CLR[myRole]||"#334"}}>
              <span>{ROLE_ICONS[myRole]}</span>
              <span style={{color:ROLE_CLR[myRole]||"#aaa"}}>{ROLES[myRole]}</span>
              <span className="chip-addr">{short(account)}</span>
            </div>
          : <button className="btn-primary" onClick={connect} disabled={loading}>🦊 Connect</button>
        }
      </header>

      {/* Notification */}
      {msg.text && <div className={`notif notif-${msg.type}`}>{msg.text}</div>}

      {/* Role switcher banner — always visible after connect */}
      {account && (
        <div className="switch-bar">
          <div className="switch-steps">
            {[1,2,3,4].map((r,i)=>(
              <span key={r} className="switch-step-row">
                <span className={`switch-pill ${myRole===r?"switch-pill-active":""}`}
                  style={myRole===r?{background:ROLE_CLR[r]+"22",borderColor:ROLE_CLR[r],color:ROLE_CLR[r]}:{}}>
                  {ROLE_ICONS[r]} {ROLES[r]}
                  {myRole===r && <span className="you-tag">YOU</span>}
                </span>
                {i<3 && <span className="arr">›</span>}
              </span>
            ))}
          </div>
          <span className="switch-tip">Switch accounts in MetaMask to change role</span>
        </div>
      )}

      {!account ? (
        <div className="landing">
          <p className="land-icon">⛓️</p>
          <h2>Supply Chain DApp</h2>
          <p>Track products from manufacturer to consumer on-chain.</p>
          <button className="btn-primary btn-lg" onClick={connect} disabled={loading}>🦊 Connect MetaMask</button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="tabs">
            {["products","register","admin"].map(t=>(
              <button key={t} className={`tab ${tab===t?"tab-on":""}`} onClick={()=>setTab(t)}>
                {t==="products"?"📦 Products":t==="register"?"➕ New Product":"⚙️ Admin"}
              </button>
            ))}
            {selected && <button className={`tab ${tab==="detail"?"tab-on":""}`} onClick={()=>setTab("detail")}>🔍 #{selected.id}</button>}
          </div>

          <div className="body">

            {/* Products */}
            {tab==="products" && <>
              <div className="row-between mb1">
                <h3>Products ({products.length})</h3>
                <button className="btn-ghost" onClick={loadProds}>↻ Refresh</button>
              </div>
              {products.length===0
                ? <p className="empty">No products yet.</p>
                : <div className="grid">{products.map(p=>(
                    <div key={p.id} className="card card-hover" onClick={()=>pick(p)}>
                      <div className="row-between mb05">
                        <span className="pid">#{p.id}</span>
                        <span className="s-badge">{S_ICONS[p.status]} {STATUSES[p.status]}</span>
                      </div>
                      <h4>{p.name}</h4>
                      <p className="muted sm">{p.desc}</p>
                      <div className="row-between muted sm mt05">
                        <span>👤 {short(p.owner)}</span>
                        <span>{fmtTs(p.ts)}</span>
                      </div>
                      <div className="prog"><div className="prog-fill" style={{width:`${(p.status/6)*100}%`}}/></div>
                    </div>
                  ))}</div>
              }
            </>}

            {/* Register Product */}
            {tab==="register" && <>
              <h3 className="mb1">Register New Product</h3>
              {myRole!==1
                ? <div className="warn-box">⚠️ Only Manufacturers can register products. Your role: <strong>{ROLES[myRole]}</strong>. Switch account in MetaMask.</div>
                : <div className="form-box">
                    <label>Name *</label>
                    <input placeholder="Product name" value={newProd.name} onChange={e=>setNewProd({...newProd,name:e.target.value})}/>
                    <label>Description</label>
                    <textarea rows={3} placeholder="Details..." value={newProd.desc} onChange={e=>setNewProd({...newProd,desc:e.target.value})}/>
                    <button className="btn-primary" disabled={loading||!newProd.name}
                      onClick={()=>tx(()=>contract.registerProduct(newProd.name,newProd.desc),`"${newProd.name}" registered!`)}>
                      🏭 Register on Chain
                    </button>
                  </div>
              }
            </>}

            {/* Admin */}
            {tab==="admin" && <>
              <h3 className="mb1">Register Participant</h3>
              <p className="muted mb1">Only the contract owner can do this.</p>
              <div className="form-box">
                <label>Wallet Address *</label>
                <input placeholder="0x..." value={regP.addr} onChange={e=>setRegP({...regP,addr:e.target.value})}/>
                <label>Role</label>
                <select value={regP.role} onChange={e=>setRegP({...regP,role:e.target.value})}>
                  <option value="1">Manufacturer</option>
                  <option value="2">Distributor</option>
                  <option value="3">Retailer</option>
                  <option value="4">Customer</option>
                </select>
                <label>Name</label>
                <input placeholder="Company / person name" value={regP.name} onChange={e=>setRegP({...regP,name:e.target.value})}/>
                <button className="btn-primary" disabled={loading||!regP.addr}
                  onClick={()=>tx(()=>contract.registerParticipant(regP.addr,Number(regP.role),regP.name),`${regP.name} registered!`)}>
                  ⚙️ Register
                </button>
              </div>
            </>}

            {/* Detail */}
            {tab==="detail" && selected && <>
              <button className="btn-ghost mb1" onClick={()=>setTab("products")}>← Back</button>
              <div className="card">
                <div className="row-between mb1">
                  <div><h3>#{selected.id} — {selected.name}</h3><p className="muted">{selected.desc}</p></div>
                  <span className="s-badge lg">{S_ICONS[selected.status]} {STATUSES[selected.status]}</span>
                </div>
                <div className="meta-row mb1">
                  <div className="meta-box"><span className="muted sm">Owner</span><span className="mono">{short(selected.owner)}</span></div>
                  <div className="meta-box"><span className="muted sm">Created</span><span className="mono">{fmtTs(selected.ts)}</span></div>
                </div>

                {/* Step progress */}
                <div className="steps">
                  {STATUSES.map((s,i)=>(
                    <div key={i} className={`step ${i<=selected.status?"done":""} ${i===selected.status?"cur":""}`}>
                      <div className="sdot">{S_ICONS[i]}</div>
                      <div className="slabel">{s}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="action-box">
                  <p className="muted sm mb05">Actions for <strong style={{color:ROLE_CLR[myRole]||"#aaa"}}>{ROLES[myRole]}</strong></p>
                  {myRole===1&&isOwner(selected)&&selected.status===0&&<>
                    <input className="mono" placeholder="Distributor address" value={target} onChange={e=>setTarget(e.target.value)}/>
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.shipToDistributor(selected.id,target),"Shipped to Distributor!")}>🚚 Ship to Distributor</button>
                  </>}
                  {myRole===2&&isOwner(selected)&&selected.status===1&&
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.receiveFromManufacturer(selected.id),"Received from Manufacturer!")}>📦 Confirm Receipt</button>}
                  {myRole===2&&isOwner(selected)&&selected.status===2&&<>
                    <input className="mono" placeholder="Retailer address" value={target} onChange={e=>setTarget(e.target.value)}/>
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.shipToRetailer(selected.id,target),"Shipped to Retailer!")}>🚛 Ship to Retailer</button>
                  </>}
                  {myRole===3&&isOwner(selected)&&selected.status===3&&
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.receiveFromDistributor(selected.id),"Received from Distributor!")}>🏪 Confirm Receipt</button>}
                  {myRole===3&&isOwner(selected)&&selected.status===4&&<>
                    <input className="mono" placeholder="Customer address" value={target} onChange={e=>setTarget(e.target.value)}/>
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.sellToCustomer(selected.id,target),"Sold to Customer!")}>💳 Sell to Customer</button>
                  </>}
                  {myRole===4&&isOwner(selected)&&selected.status===5&&
                    <button className="btn-primary" disabled={loading} onClick={()=>tx(()=>contract.confirmDelivery(selected.id),"Delivery confirmed!")}>✅ Confirm Delivery</button>}
                  {selected.status===6 && <p style={{color:"#4ade80",fontWeight:600}}>🎉 Fully delivered!</p>}
                  {!isOwner(selected)&&selected.status<6 && <p className="muted sm">You are not the current owner of this product.</p>}
                </div>

                {/* Audit trail */}
                <h4 className="mt1 mb05">📋 Audit Trail</h4>
                <div className="timeline">
                  {history.map((h,i)=>(
                    <div key={i} className="t-item">
                      <div className="t-dot"/>
                      <div className="t-body">
                        <div className="row-between mb025">
                          <span className="role-pill" style={{background:ROLE_CLR[h.role]||"#334"}}>{ROLES[h.role]}</span>
                          <span className="muted sm">{S_ICONS[h.status]} {STATUSES[h.status]}</span>
                        </div>
                        <p className="sm">{h.note}</p>
                        <p className="muted sm mono">{short(h.actor)} · {fmtTs(h.ts)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>}

          </div>
        </>
      )}

      <footer className="foot">Supply Chain DApp · By <strong>Fahad Saleem</strong> · Polygon + Hardhat</footer>
    </div>
  );
}
