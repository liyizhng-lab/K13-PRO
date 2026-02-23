// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from './lib/supabase'
import { 
  Activity, DollarSign, BarChart3, TrendingUp, Target, 
  CloudUpload, Calendar as CalIcon, Eye, X, Trash2, Edit, PieChart, 
  BookOpen, PlayCircle, Layers, Plus
} from 'lucide-react'

// 動態引入圖表
const TradeChart = dynamic(() => import('./components/TradeChart'), { ssr: false })

// 預設策略與模型定義
const STRATEGY_OPTIONS: any = {
  'ICT (Smart Money)': {
    models: ['2022 Model', 'Silver Bullet (銀彈)', 'Unicorn (獨角獸)', 'Breaker Block', 'MMXM', 'Judas Swing', 'Power of 3 (AMD)', 'Turtle Soup (殺龜)'],
    confluences: ['FVG (Gap)', 'MSS (結構破壞)', 'Order Block', 'Liquidity Sweep (掃流動性)', 'SMT Divergence', 'Premium/Discount', 'OTE', 'BPR']
  },
  'Orderflow (訂單流)': {
    models: ['Delta Divergence', 'Absorption (吸收)', 'Auction Reversal', 'VWAP Fade', 'Passive Limit', 'Stop Run'],
    confluences: ['CVD Divergence', 'POC Control', 'High Volume Node', 'Low Volume Node', 'Imbalance (Footprint)', 'Tape Reading', 'Open Interest']
  },
  'Classic (傳統技術)': {
    models: ['Breakout (突破)', 'Pullback (回調)', 'Reversal (反轉)', 'Trend Following', 'Range Bound', 'Double Top/Bottom', 'Head & Shoulders'],
    confluences: ['Support/Resistance', 'Trendline', 'Moving Average (MA)', 'RSI Divergence', 'Volume Spike', 'Fibonacci', 'Chart Pattern', 'Candlestick Pattern']
  }
}

const SESSIONS = ['ASIA (亞盤)', 'LONDON (歐盤)', 'NY AM (美初)', 'NY PM (美尾)']
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', 'Daily']
const MENTAL_STATES = ['Flow State (心流)', 'FOMO (追單)', 'Hesitation (猶豫)', 'Revenge (報復)', 'Anxious (焦慮)', 'Bored (無聊)']

export default function Home() {
  const [isMounted, setIsMounted] = useState(false)
  const [trades, setTrades] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [readingNote, setReadingNote] = useState<string | null>(null)

  const [accountBalance, setAccountBalance] = useState('10000')
  const [riskPercent, setRiskPercent] = useState('1')
  const [showSim, setShowSim] = useState(false)
  const [simRisk, setSimRisk] = useState('1')

  // 🔥 自訂欄位狀態
  const [customStrategyInput, setCustomStrategyInput] = useState('')
  const [customModelInput, setCustomModelInput] = useState('')
  const [customConfluenceInput, setCustomConfluenceInput] = useState('')

  // 表單資料
  const [formData, setFormData] = useState({
    symbol: '', direction: 'LONG', entry_price: '', exit_price: '', stop_loss: '', take_profit: '', 
    position_size: '', screenshot_url: '', 
    strategy_type: 'ICT (Smart Money)', entry_model: '', 
    session: 'NY AM (美初)', timeframe: '15m', mental_state: 'Flow State (心流)', 
    confluences: [] as string[], 
    pnl_net: '', planned_rr: '', entry_date: '', notes: ''
  })

  const [stats, setStats] = useState({ totalPnl: 0, winRate: 0, totalTrades: 0, avgRR: 0 })
  const [strategyStats, setStrategyStats] = useState<any>({})
  const [calendarData, setCalendarData] = useState<Record<string, number>>({})
  const [rMultiples, setRMultiples] = useState<number[]>([])

  useEffect(() => {
    setIsMounted(true)
    setFormData(prev => ({ ...prev, entry_date: new Date().toISOString().split('T')[0] }))
    fetchData()
  }, [])

  // 風控與 RR 計算機
  useEffect(() => {
    if (formData.entry_price && formData.stop_loss && accountBalance && riskPercent) {
      const entry = parseFloat(formData.entry_price); const sl = parseFloat(formData.stop_loss)
      const balance = parseFloat(accountBalance); const risk = parseFloat(riskPercent)
      if (entry > 0 && sl > 0 && balance > 0) {
        const riskAmount = balance * (risk / 100); const priceDiff = Math.abs(entry - sl)
        if (priceDiff > 0) setFormData(prev => ({ ...prev, position_size: (riskAmount / priceDiff).toFixed(4) }))
      }
      if (formData.take_profit) {
        const tp = parseFloat(formData.take_profit)
        let rr = formData.direction === 'LONG' ? (tp - entry) / (entry - sl) : (entry - tp) / (sl - entry)
        if (isFinite(rr) && rr > 0) setFormData(prev => ({ ...prev, planned_rr: rr.toFixed(2) }))
      }
    }
  }, [formData.entry_price, formData.stop_loss, formData.take_profit, formData.direction, accountBalance, riskPercent])

  async function fetchData() {
    try {
      const { data: tradeData } = await supabase.from('trades').select('*').order('entry_date', { ascending: true })
      if (tradeData) {
        calculateStats(tradeData)
        setTrades(tradeData.reverse())
      }
      const { data: acc } = await supabase.from('accounts').select('id').single()
      if (acc) setAccountId(acc.id)
      else {
        const { data: newAcc } = await supabase.from('accounts').insert([{ name: 'Main', balance: 10000 }]).select().single()
        if (newAcc) setAccountId(newAcc.id)
      }
    } catch (e) { console.error(e) }
  }

  function calculateStats(data: any[]) {
    const totalPnl = data.reduce((acc, curr) => acc + (curr.pnl_net || 0), 0)
    const winRate = data.length > 0 ? (data.filter(t => (t.pnl_net || 0) > 0).length / data.length) * 100 : 0
    
    const stratMap: any = {}; const calMap: Record<string, number> = {}; const rList: number[] = []
    let totalActualRR = 0; let rrCount = 0;

    data.forEach(t => {
      if(t.entry_date) {
        const d = t.entry_date.split('T')[0]
        if(!calMap[d]) calMap[d] = 0; calMap[d] += (t.pnl_net || 0)
      }
      const type = t.strategy_type || 'Unknown'
      if(!stratMap[type]) stratMap[type] = { wins: 0, total: 0, pnl: 0 }
      stratMap[type].total++; stratMap[type].pnl += (t.pnl_net || 0)
      if((t.pnl_net || 0) > 0) stratMap[type].wins++

      // 使用資料庫存的 actual_rr 或重新計算
      let r = t.actual_rr || 0;
      if (!r && t.entry_price && t.stop_loss && t.position_size) {
          const riskAmt = Math.abs(t.entry_price - t.stop_loss) * t.position_size
          if (riskAmt > 0) r = (t.pnl_net / riskAmt)
      }
      if (r > 10) r = 10; if (r < -5) r = -5;
      rList.push(r)
      if (isFinite(r)) { totalActualRR += r; rrCount++; }
    })
    
    const avgRR = rrCount > 0 ? totalActualRR / rrCount : 0
    setStats({ totalPnl, winRate, totalTrades: data.length, avgRR })
    setStrategyStats(stratMap); setCalendarData(calMap); setRMultiples(rList.reverse())
  }

  const toggleConfluence = (item: string) => {
    setFormData(prev => {
      const exists = prev.confluences.includes(item)
      return { ...prev, confluences: exists ? prev.confluences.filter(i => i !== item) : [...prev.confluences, item] }
    })
  }

  // 🔥 處理手動新增共振因素
  const addCustomConfluence = () => {
    if (!customConfluenceInput.trim()) return
    const newItem = customConfluenceInput.trim()
    if (!formData.confluences.includes(newItem)) {
        setFormData(prev => ({ ...prev, confluences: [...prev.confluences, newItem] }))
    }
    setCustomConfluenceInput('')
  }

  async function handleImageUpload(e: any) {
    try {
      setUploading(true)
      const file = e.target.files[0]
      if (!file) return
      const fileName = `${Date.now()}-${Math.floor(Math.random()*1000)}`
      const { error } = await supabase.storage.from('trade-images').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('trade-images').getPublicUrl(fileName)
      setFormData(prev => ({ ...prev, screenshot_url: data.publicUrl }))
      alert("✅ 圖片上傳成功！")
    } catch (error: any) { alert('上傳失敗: ' + error.message) } 
    finally { setUploading(false) }
  }

  async function handleSubmit(e: any) {
    e.preventDefault()
    if (!accountId) return alert("System Error: No Account ID")
    
    // 🔥 計算實際損益比 (Actual RR)
    let actualRR = 0
    if (formData.entry_price && formData.stop_loss && formData.pnl_net && formData.position_size) {
        // RR = 淨利 / 總風險金額
        const riskAmt = Math.abs(parseFloat(formData.entry_price) - parseFloat(formData.stop_loss)) * parseFloat(formData.position_size)
        if (riskAmt > 0) actualRR = parseFloat(formData.pnl_net) / riskAmt
    } else if (formData.entry_price && formData.exit_price && formData.stop_loss) {
        // 如果沒填 PnL 但有填出場價
        const entry = parseFloat(formData.entry_price); const exit = parseFloat(formData.exit_price); const sl = parseFloat(formData.stop_loss)
        actualRR = formData.direction === 'LONG' ? (exit - entry) / (entry - sl) : (entry - exit) / (sl - entry)
    }

    // 判斷是否使用自訂策略/模型
    const finalStrategy = formData.strategy_type === 'Custom' ? customStrategyInput || 'Custom' : formData.strategy_type
    const finalModel = formData.entry_model === 'Custom' ? customModelInput || 'Custom' : formData.entry_model

    const tradeData = {
      account_id: accountId, symbol: formData.symbol.toUpperCase(), direction: formData.direction,
      entry_price: parseFloat(formData.entry_price)||0, exit_price: parseFloat(formData.exit_price)||0,
      stop_loss: parseFloat(formData.stop_loss)||0, take_profit: parseFloat(formData.take_profit)||0,
      position_size: parseFloat(formData.position_size)||0, pnl_net: parseFloat(formData.pnl_net)||0,
      planned_rr: parseFloat(formData.planned_rr)||0, actual_rr: isFinite(actualRR) ? actualRR : 0,
      screenshot_url: formData.screenshot_url,
      strategy_type: finalStrategy, entry_model: finalModel,
      session: formData.session, timeframe: formData.timeframe, mental_state: formData.mental_state,
      confluences: formData.confluences, notes: formData.notes,
      entry_date: formData.entry_date, status: (parseFloat(formData.pnl_net)||0)>0 ? 'WIN':'LOSS'
    }

    if (editingId) await supabase.from('trades').update(tradeData).eq('id', editingId)
    else await supabase.from('trades').insert([tradeData])
    
    setShowForm(false); setEditingId(null); fetchData()
    setFormData({...formData, symbol:'', pnl_net:'', screenshot_url:'', entry_price:'', exit_price:'', stop_loss:'', take_profit:'', position_size:'', planned_rr: '', confluences: [], notes: '', strategy_type: 'ICT (Smart Money)', entry_model: ''})
    setCustomStrategyInput(''); setCustomModelInput('')
  }

  const handleDelete = async (id: number) => {
    if(confirm("確定刪除？")) { await supabase.from('trades').delete().eq('id', id); fetchData() }
  }

  const getChartData = () => {
    const sorted = [...trades].sort((a,b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
    let running = 0; let simBalance = 10000 
    return sorted.map(t => { 
        running += (t.pnl_net || 0);
        let r = t.actual_rr || 0;
        if (!r && t.entry_price && t.stop_loss && t.position_size) {
            const riskAmt = Math.abs(t.entry_price - t.stop_loss) * t.position_size
            if (riskAmt > 0) r = (t.pnl_net / riskAmt)
        }
        const riskAmount = simBalance * (parseFloat(simRisk) / 100)
        simBalance += (riskAmount * r)
        return { date: t.entry_date, pnl: running, simPnl: showSim ? (simBalance - 10000) : null } 
    })
  }

  const currentModels = STRATEGY_OPTIONS[formData.strategy_type]?.models || []
  const currentConfluences = STRATEGY_OPTIONS[formData.strategy_type]?.confluences || []

  if (!isMounted) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading K13 V17.5 PRO...</div>

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">K13 Trading Journal</h1>
           <p className="text-xs text-slate-500 font-mono mt-1">V17.5 PRO | Customizable & Auto-RR</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 px-4 py-2 rounded font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20">
          {showForm ? 'Cancel' : '+ New Trade'}
        </button>
      </div>

      <div className="flex gap-6 mb-8 p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex-wrap items-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded border border-slate-800">
          <DollarSign className="text-blue-400 w-4 h-4"/>
          <input type="number" value={accountBalance} onChange={e=>setAccountBalance(e.target.value)} className="bg-transparent w-24 text-white font-bold outline-none text-sm"/>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded border border-slate-800">
          <Target className="text-yellow-400 w-4 h-4"/>
          <input type="number" value={riskPercent} onChange={e=>setRiskPercent(e.target.value)} className="bg-transparent w-12 text-white font-bold outline-none text-sm"/>
          <span className="text-slate-500 text-xs">%</span>
        </div>
        <span className="text-xs text-slate-400 ml-auto">Risk Amount: <span className="text-red-400 font-mono font-bold">${(parseFloat(accountBalance)*parseFloat(riskPercent)/100).toFixed(0)}</span></span>
      </div>

      {showForm && (
        <div className="mb-8 p-6 bg-slate-900 border border-emerald-500/30 rounded-xl animate-in slide-in-from-top-2 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="text-xs text-slate-400 block mb-1">Date</label><input type="date" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={formData.entry_date} onChange={e=>setFormData({...formData, entry_date: e.target.value})}/></div>
              <div><label className="text-xs text-slate-400 block mb-1">Symbol</label><input list="coins" type="text" placeholder="BTCUSDT" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm uppercase" value={formData.symbol} onChange={e=>setFormData({...formData, symbol: e.target.value})}/><datalist id="coins"><option value="BTCUSDT"/><option value="ETHUSDT"/><option value="SOLUSDT"/></datalist></div>
              <div><label className="text-xs text-slate-400 block mb-1">Session</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={formData.session} onChange={e=>setFormData({...formData, session: e.target.value})}>{SESSIONS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs text-slate-400 block mb-1">Timeframe</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={formData.timeframe} onChange={e=>setFormData({...formData, timeframe: e.target.value})}>{TIMEFRAMES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>

            {/* 🔥 自訂策略與模型區塊 */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs text-blue-400 block mb-1 font-bold">Strategy (策略)</label>
                        <select className="w-full bg-slate-900 border border-blue-500/50 rounded p-2 text-sm mb-2" value={formData.strategy_type} onChange={e=>{setFormData({...formData, strategy_type: e.target.value, entry_model: '', confluences: []})}}>
                            {Object.keys(STRATEGY_OPTIONS).map(s=><option key={s} value={s}>{s}</option>)}
                            <option value="Custom">➕ Custom (自訂策略)</option>
                        </select>
                        {formData.strategy_type === 'Custom' && (
                            <input type="text" placeholder="輸入自訂策略名稱..." className="w-full bg-slate-800 border border-blue-500/50 rounded p-2 text-sm" value={customStrategyInput} onChange={e=>setCustomStrategyInput(e.target.value)} required/>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Entry Model (模型)</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm mb-2" value={formData.entry_model} onChange={e=>setFormData({...formData, entry_model: e.target.value})}>
                            <option value="">-- Select Model --</option>
                            {currentModels.map((m:string)=><option key={m} value={m}>{m}</option>)}
                            <option value="Custom">➕ Custom (自訂模型)</option>
                        </select>
                        {formData.entry_model === 'Custom' && (
                            <input type="text" placeholder="輸入自訂模型名稱..." className="w-full bg-slate-800 border border-slate-500 rounded p-2 text-sm" value={customModelInput} onChange={e=>setCustomModelInput(e.target.value)} required/>
                        )}
                    </div>
                </div>

                {/* 🔥 自訂共振因素區塊 */}
                <div>
                    <label className="text-xs text-slate-400 block mb-2">Confluences (共振因素)</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {/* 顯示預設共振與已添加的共振 */}
                        {[...new Set([...currentConfluences, ...formData.confluences])].map((c:any) => (
                            <div key={c} onClick={()=>toggleConfluence(c)} className={`cursor-pointer px-3 py-1 rounded text-xs border transition-colors ${formData.confluences.includes(c) ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                {c}
                            </div>
                        ))}
                    </div>
                    {/* 添加按鈕 */}
                    <div className="flex items-center gap-2 max-w-sm">
                        <input type="text" placeholder="輸入其他共振因素..." className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs outline-none focus:border-emerald-500" value={customConfluenceInput} onChange={e=>setCustomConfluenceInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault(); addCustomConfluence()}}}/>
                        <button type="button" onClick={addCustomConfluence} className="bg-slate-800 p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"><Plus className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div><label className="text-xs text-blue-400 font-bold block mb-1">Entry</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" value={formData.entry_price} onChange={e=>setFormData({...formData, entry_price: e.target.value})}/></div>
              <div><label className="text-xs text-red-400 font-bold block mb-1">Stop Loss</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" value={formData.stop_loss} onChange={e=>setFormData({...formData, stop_loss: e.target.value})}/></div>
              <div><label className="text-xs text-emerald-400 font-bold block mb-1">Take Profit</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" value={formData.take_profit} onChange={e=>setFormData({...formData, take_profit: e.target.value})}/></div>
              <div className="bg-blue-900/20 p-2 rounded border border-blue-900/50"><label className="text-[10px] text-blue-300 block mb-1">Size (Auto)</label><div className="text-lg font-bold text-white font-mono">{formData.position_size || '-'}</div></div>
              <div><label className="text-xs text-slate-400 block mb-1">PnL</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" value={formData.pnl_net} onChange={e=>setFormData({...formData, pnl_net: e.target.value})}/></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-xs text-slate-400 block mb-1">Direction</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={formData.direction} onChange={e=>setFormData({...formData, direction: e.target.value})}><option value="LONG">LONG</option><option value="SHORT">SHORT</option></select></div>
                 <div><label className="text-xs text-purple-400 block mb-1">Mental State</label><select className="w-full bg-slate-950 border border-purple-500/30 rounded p-2 text-sm" value={formData.mental_state} onChange={e=>setFormData({...formData, mental_state: e.target.value})}>{MENTAL_STATES.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
            </div>

            <div>
               <label className="text-xs text-slate-400 block mb-1">Journal Notes</label>
               <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm h-32 focus:border-emerald-500 outline-none" placeholder="為什麼進場？執行上有什麼失誤？..." value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}/>
            </div>

            <div className="border border-dashed border-slate-700 p-4 rounded hover:border-blue-500 cursor-pointer relative flex flex-col items-center justify-center h-24">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
              <CloudUpload className="text-slate-500 mb-2"/>
              <p className="text-xs text-slate-400">{uploading ? 'Uploading...' : formData.screenshot_url ? '✅ Image Ready' : 'Upload Screenshot'}</p>
            </div>

            <button disabled={uploading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded font-bold hover:shadow-lg transition">
              {editingId ? 'Update Trade' : 'Save Log'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Net PnL</div><div className={`text-2xl font-bold ${stats.totalPnl>=0?'text-emerald-400':'text-red-400'}`}>${stats.totalPnl.toLocaleString()}</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Win Rate</div><div className="text-2xl font-bold text-blue-400">{stats.winRate.toFixed(1)}%</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Trades</div><div className="text-2xl font-bold text-purple-400">{stats.totalTrades}</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Avg Actual RR</div><div className="text-2xl font-bold text-yellow-400">{stats.avgRR.toFixed(2)}R</div></div>
      </div>

      <div className="mb-8">
        <h2 className="text-slate-400 text-sm font-bold uppercase mb-4 flex items-center gap-2"><Layers className="w-4 h-4"/> R-Multiple Heatmap (Last 50)</h2>
        <div className="flex flex-wrap gap-1">
            {rMultiples.slice(0, 50).map((r, i) => {
                let colorClass = 'bg-slate-800'
                if (r <= -0.8) colorClass = 'bg-red-600'
                else if (r < 0) colorClass = 'bg-red-900/60'
                else if (r > 0 && r < 2) colorClass = 'bg-emerald-900/60'
                else if (r >= 2) colorClass = 'bg-emerald-500'

                return (
                    <div key={i} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${colorClass}`} title={`Trade #${trades.length - i}: ${r.toFixed(2)}R`}>
                        {r.toFixed(1)}
                    </div>
                )
            })}
            {rMultiples.length === 0 && <span className="text-slate-600 text-xs">No data yet.</span>}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8 relative">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-slate-300 font-bold flex items-center gap-2"><Activity className="w-4 h-4"/> Equity Curve</h2>
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded border border-slate-700">
                <PlayCircle className={`w-4 h-4 ${showSim ? 'text-purple-400' : 'text-slate-500'}`}/>
                <label className="text-xs text-slate-300 cursor-pointer select-none">
                    <input type="checkbox" className="mr-2" checked={showSim} onChange={e=>setShowSim(e.target.checked)}/>
                    Simulate Risk
                </label>
                {showSim && <input type="number" value={simRisk} onChange={e=>setSimRisk(e.target.value)} className="w-10 bg-transparent border-b border-purple-500 text-center text-xs font-bold focus:outline-none"/>}
                {showSim && <span className="text-xs text-slate-500">%</span>}
            </div>
        </div>
        <TradeChart data={getChartData()}/>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase"><tr><th className="p-4">Date</th><th className="p-4">Symbol</th><th className="p-4">Setup</th><th className="p-4">Note</th><th className="p-4 text-right">PnL / RR</th><th className="p-4 text-center">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-slate-800/50">
                <td className="p-4 text-slate-300">{t.entry_date}</td>
                <td className="p-4 font-bold"><div>{t.symbol} <span className={t.direction==='LONG'?'text-emerald-400':'text-red-400'}>{t.direction}</span></div><div className="text-[10px] text-slate-500">{t.session}</div></td>
                <td className="p-4 text-slate-300">
                    <div className="text-blue-400 text-xs">{t.strategy_type?.split(' ')[0]}</div>
                    <div className="text-[10px] text-slate-400">{t.entry_model}</div>
                    {/* 顯示該筆訂單的共振因素 */}
                    {t.confluences && t.confluences.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {t.confluences.map((c:string, i:number) => <span key={i} className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded">{c}</span>)}
                        </div>
                    )}
                </td>
                <td className="p-4">
                    <div className="flex gap-2">
                        {t.screenshot_url && <button onClick={()=>setSelectedImage(t.screenshot_url)} className="text-blue-400 hover:text-blue-300"><Eye className="w-4 h-4"/></button>}
                        {t.notes && <button onClick={()=>setReadingNote(t.notes)} className="text-emerald-400 hover:text-emerald-300"><BookOpen className="w-4 h-4"/></button>}
                        {!t.screenshot_url && !t.notes && <span className="text-slate-600">-</span>}
                    </div>
                </td>
                {/* 🔥 顯示 PnL 與 單筆 RR */}
                <td className={`p-4 text-right font-bold ${t.pnl_net>0?'text-emerald-400':'text-red-400'}`}>
                    <div>${t.pnl_net}</div>
                    <div className={`text-[10px] font-mono ${t.actual_rr > 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                        {t.actual_rr ? `${t.actual_rr > 0 ? '+' : ''}${t.actual_rr.toFixed(2)}R` : '-'}
                    </div>
                </td>
                <td className="p-4 text-center flex justify-center gap-2">
                  <button onClick={()=>{setEditingId(t.id); setFormData({...t}); setShowForm(true)}}><Edit className="w-4 h-4 text-slate-400 hover:text-blue-400"/></button>
                  <button onClick={()=>handleDelete(t.id)}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={()=>setSelectedImage(null)}>
           <div className="relative max-w-5xl"><img src={selectedImage} className="rounded shadow-2xl"/><button className="absolute -top-10 right-0 text-white"><X/></button></div>
        </div>
      )}

      {readingNote && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={()=>setReadingNote(null)}>
           <div className="bg-slate-900 border border-emerald-500/50 p-6 rounded-xl max-w-lg w-full shadow-2xl relative" onClick={e=>e.stopPropagation()}>
               <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5"/> Trade Journal</h3>
               <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar">
                   {readingNote}
               </div>
               <button onClick={()=>setReadingNote(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X/></button>
           </div>
        </div>
      )}
    </main>
  )
}