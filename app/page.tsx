'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from './lib/supabase'
import { 
  Activity, DollarSign, BarChart3, TrendingUp, Target, 
  CloudUpload, Calendar as CalIcon, Eye, X, Trash2, Edit 
} from 'lucide-react'

// 🔥 動態引入圖表 (強制關閉伺服器渲染，防止崩潰)
const TradeChart = dynamic(() => import('./components/TradeChart'), { 
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center text-slate-500 animate-pulse">Loading Chart...</div>
})

export default function Home() {
  const [isMounted, setIsMounted] = useState(false)
  const [trades, setTrades] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // 資金與風控
  const [accountBalance, setAccountBalance] = useState('10000')
  const [riskPercent, setRiskPercent] = useState('1')

  // 表單資料
  const [formData, setFormData] = useState({
    symbol: '', direction: 'LONG', entry_price: '', exit_price: '', stop_loss: '', take_profit: '', 
    position_size: '', screenshot_url: '', strategy_type: 'ICT', entry_model: '', 
    pnl_net: '', planned_rr: '', entry_date: ''
  })

  const [stats, setStats] = useState({ totalPnl: 0, winRate: 0, totalTrades: 0, avgRR: 0 })
  const [calendarData, setCalendarData] = useState<Record<string, number>>({})

  useEffect(() => {
    setIsMounted(true)
    setFormData(prev => ({ ...prev, entry_date: new Date().toISOString().split('T')[0] }))
    fetchData()
  }, [])

  // 自動計算倉位與盈虧比
  useEffect(() => {
    if (formData.entry_price && formData.stop_loss && accountBalance && riskPercent) {
      const entry = parseFloat(formData.entry_price)
      const sl = parseFloat(formData.stop_loss)
      const balance = parseFloat(accountBalance)
      const risk = parseFloat(riskPercent)
      
      if (entry > 0 && sl > 0 && balance > 0) {
        const riskAmount = balance * (risk / 100)
        const priceDiff = Math.abs(entry - sl)
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
      // 1. 抓取交易
      const { data: tradeData } = await supabase.from('trades').select('*').order('entry_date', { ascending: true })
      if (tradeData) {
        calculateStats(tradeData)
        setTrades(tradeData.reverse())
      }
      // 2. 抓取帳戶 (如果沒有就新建)
      const { data: acc } = await supabase.from('accounts').select('id').single()
      if (acc) {
        setAccountId(acc.id)
      } else {
        const { data: newAcc } = await supabase.from('accounts').insert([{ name: 'Main', balance: 10000 }]).select().single()
        if (newAcc) setAccountId(newAcc.id)
      }
    } catch (e) { console.error(e) }
  }

  function calculateStats(data: any[]) {
    const totalPnl = data.reduce((acc, curr) => acc + (curr.pnl_net || 0), 0)
    const winRate = data.length > 0 ? (data.filter(t => (t.pnl_net || 0) > 0).length / data.length) * 100 : 0
    const avgRR = data.length > 0 ? data.reduce((acc, curr) => acc + (curr.planned_rr || 0), 0) / data.length : 0
    
    setStats({ totalPnl, winRate, totalTrades: data.length, avgRR })
    
    const calMap: Record<string, number> = {}
    data.forEach(t => {
      if(t.entry_date) {
        const d = t.entry_date.split('T')[0]
        if(!calMap[d]) calMap[d] = 0; calMap[d] += (t.pnl_net || 0)
      }
    })
    setCalendarData(calMap)
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
    
    const tradeData = {
      account_id: accountId,
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      entry_price: parseFloat(formData.entry_price) || 0,
      exit_price: parseFloat(formData.exit_price) || 0,
      stop_loss: parseFloat(formData.stop_loss) || 0,
      take_profit: parseFloat(formData.take_profit) || 0,
      position_size: parseFloat(formData.position_size) || 0,
      pnl_net: parseFloat(formData.pnl_net) || 0,
      planned_rr: parseFloat(formData.planned_rr) || 0,
      screenshot_url: formData.screenshot_url,
      strategy_type: formData.strategy_type,
      entry_model: formData.entry_model,
      entry_date: formData.entry_date,
      status: (parseFloat(formData.pnl_net) || 0) > 0 ? 'WIN' : 'LOSS'
    }

    if (editingId) {
      await supabase.from('trades').update(tradeData).eq('id', editingId)
    } else {
      await supabase.from('trades').insert([tradeData])
    }
    
    setShowForm(false)
    setEditingId(null)
    setFormData({...formData, symbol:'', pnl_net:'', screenshot_url:'', entry_price:'', exit_price:'', stop_loss:'', take_profit:'', position_size:'', planned_rr: ''})
    fetchData()
  }

  const handleDelete = async (id: number) => {
    if(confirm("確定刪除？")) {
      await supabase.from('trades').delete().eq('id', id)
      fetchData()
    }
  }

  const getChartData = () => {
    const sorted = [...trades].sort((a,b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
    let running = 0
    return sorted.map(t => { running += (t.pnl_net || 0); return { date: t.entry_date, pnl: running } })
  }

  if (!isMounted) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading K13 Pro...</div>

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">K13 Pro Journal</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 px-4 py-2 rounded font-bold hover:bg-emerald-500 transition">
          {showForm ? 'Cancel' : '+ New Trade'}
        </button>
      </div>

      {/* 資金設定欄 */}
      <div className="flex gap-4 mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex-wrap">
        <div className="flex items-center gap-2">
          <DollarSign className="text-blue-400"/>
          <input type="number" value={accountBalance} onChange={e=>setAccountBalance(e.target.value)} className="bg-transparent border-b border-slate-700 w-24 text-white font-bold outline-none"/>
        </div>
        <div className="flex items-center gap-2">
          <Target className="text-yellow-400"/>
          <input type="number" value={riskPercent} onChange={e=>setRiskPercent(e.target.value)} className="bg-transparent border-b border-slate-700 w-12 text-white font-bold outline-none"/>
          <span className="text-slate-500 text-sm">% Risk = <span className="text-red-400">${(parseFloat(accountBalance)*parseFloat(riskPercent)/100).toFixed(0)}</span></span>
        </div>
      </div>

      {/* 新增表單 */}
      {showForm && (
        <div className="mb-8 p-6 bg-slate-900 border border-emerald-500/30 rounded-xl animate-in slide-in-from-top-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="text-xs text-slate-400 block">Date</label><input type="date" required className="w-full bg-slate-950 border border-slate-700 rounded p-2" value={formData.entry_date} onChange={e=>setFormData({...formData, entry_date: e.target.value})}/></div>
              <div><label className="text-xs text-slate-400 block">Symbol</label><input list="coins" type="text" placeholder="BTCUSDT" className="w-full bg-slate-950 border border-slate-700 rounded p-2 uppercase" value={formData.symbol} onChange={e=>setFormData({...formData, symbol: e.target.value})}/><datalist id="coins"><option value="BTCUSDT"/><option value="ETHUSDT"/><option value="SOLUSDT"/></datalist></div>
              <div><label className="text-xs text-slate-400 block">Direction</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2" value={formData.direction} onChange={e=>setFormData({...formData, direction: e.target.value})}><option value="LONG">LONG</option><option value="SHORT">SHORT</option></select></div>
              <div><label className="text-xs text-slate-400 block">PnL ($)</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-2" value={formData.pnl_net} onChange={e=>setFormData({...formData, pnl_net: e.target.value})}/></div>
            </div>

            {/* 計算機區域 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div><label className="text-xs text-blue-400 font-bold block">Entry</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={formData.entry_price} onChange={e=>setFormData({...formData, entry_price: e.target.value})}/></div>
              <div><label className="text-xs text-red-400 font-bold block">Stop Loss</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={formData.stop_loss} onChange={e=>setFormData({...formData, stop_loss: e.target.value})}/></div>
              <div><label className="text-xs text-emerald-400 font-bold block">Take Profit</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={formData.take_profit} onChange={e=>setFormData({...formData, take_profit: e.target.value})}/></div>
              <div className="bg-blue-900/20 p-2 rounded border border-blue-900/50"><label className="text-[10px] text-blue-300 block">Position Size</label><div className="text-lg font-bold text-white font-mono">{formData.position_size || '-'}</div></div>
              <div><label className="text-xs text-slate-400 block">Exit</label><input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={formData.exit_price} onChange={e=>setFormData({...formData, exit_price: e.target.value})}/></div>
            </div>

            {/* 圖片上傳 */}
            <div className="border border-dashed border-slate-700 p-4 rounded hover:border-blue-500 cursor-pointer relative flex flex-col items-center justify-center">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
              <CloudUpload className="text-slate-500 mb-2"/>
              <p className="text-xs text-slate-400">{uploading ? 'Uploading...' : formData.screenshot_url ? '✅ Image Ready' : 'Upload Chart Screenshot'}</p>
              {formData.screenshot_url && <img src={formData.screenshot_url} className="h-20 mt-2 rounded border border-slate-600"/>}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div><label className="text-xs text-slate-400 block">Strategy</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2" value={formData.strategy_type} onChange={e=>setFormData({...formData, strategy_type: e.target.value})}><option value="ICT">ICT</option><option value="SMC">SMC</option><option value="Breakout">Breakout</option></select></div>
               <div><label className="text-xs text-slate-400 block">Model</label><input type="text" className="w-full bg-slate-950 border border-slate-700 rounded p-2" placeholder="e.g. Silver Bullet" value={formData.entry_model} onChange={e=>setFormData({...formData, entry_model: e.target.value})}/></div>
            </div>

            <button disabled={uploading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded font-bold hover:shadow-lg transition">
              {editingId ? 'Update Trade' : 'Save Log'}
            </button>
          </form>
        </div>
      )}

      {/* 數據卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Net PnL</div><div className={`text-2xl font-bold ${stats.totalPnl>=0?'text-emerald-400':'text-red-400'}`}>${stats.totalPnl.toLocaleString()}</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Win Rate</div><div className="text-2xl font-bold text-blue-400">{stats.winRate.toFixed(1)}%</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Trades</div><div className="text-2xl font-bold text-purple-400">{stats.totalTrades}</div></div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><div className="text-slate-400 text-xs mb-1">Avg RR</div><div className="text-2xl font-bold text-yellow-400">{stats.avgRR.toFixed(2)}R</div></div>
      </div>

      {/* 圖表 */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8">
        <h2 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> Growth Curve</h2>
        <TradeChart data={getChartData()}/>
      </div>

      {/* 日曆 */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8">
        <div className="flex justify-between cursor-pointer" onClick={()=>setShowCalendar(!showCalendar)}>
           <h2 className="text-slate-300 font-bold flex items-center gap-2"><CalIcon className="w-4 h-4"/> PnL Calendar</h2>
           {showCalendar ? <div className="text-slate-500">-</div> : <div className="text-slate-500">+</div>}
        </div>
        {showCalendar && (
          <div className="grid grid-cols-7 gap-2 mt-4">
            {Array.from({length: new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()}, (_, i) => i + 1).map(d => {
               const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
               const pnl = calendarData[dateStr]
               return (
                 <div key={d} className={`p-2 border border-slate-800 rounded min-h-[50px] flex flex-col items-center justify-center ${pnl ? (pnl>0?'bg-emerald-900/20':'bg-red-900/20') : 'bg-slate-950'}`}>
                   <span className="text-xs text-slate-500">{d}</span>
                   {pnl !== undefined && <span className={`text-xs font-bold ${pnl>0?'text-emerald-400':'text-red-400'}`}>{pnl}</span>}
                 </div>
               )
            })}
          </div>
        )}
      </div>

      {/* 列表 */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase"><tr><th className="p-4">Date</th><th className="p-4">Symbol</th><th className="p-4">Strategy</th><th className="p-4">Image</th><th className="p-4 text-right">PnL</th><th className="p-4 text-center">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-slate-800/50">
                <td className="p-4 text-slate-300">{t.entry_date}</td>
                <td className="p-4 font-bold">{t.symbol} <span className={t.direction==='LONG'?'text-emerald-400':'text-red-400'}>{t.direction}</span></td>
                <td className="p-4 text-slate-300">{t.strategy_type}</td>
                <td className="p-4">{t.screenshot_url ? <button onClick={()=>setSelectedImage(t.screenshot_url)} className="text-blue-400 flex items-center gap-1"><Eye className="w-4 h-4"/> View</button> : '-'}</td>
                <td className={`p-4 text-right font-bold ${t.pnl_net>0?'text-emerald-400':'text-red-400'}`}>{t.pnl_net}</td>
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
    </main>
  )
}