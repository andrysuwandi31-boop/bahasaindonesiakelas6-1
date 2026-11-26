import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BookOpen, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Clock3, Cloud, Download, Home, KeyRound, LogOut, Menu, Play, RefreshCw,
  ShieldCheck, Sparkles, Target, TrendingUp, Trophy, Users, X, BarChart3,
  Lightbulb, FileText, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff,
  BookMarked, PencilLine, ListChecks, Search, Award
} from 'lucide-react'
import { blueprint, lessons, questionBank, guidedExamples, writingPrompts } from './data'
import { supabase, isCloudEnabled, getProfile, ensureStudentProfile, loadCloudAttempts, saveCloudAttempt, reviewCloudAttempt } from './db'
import './style.css'

const shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const escapeCSV = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
const localKey = 'jelajah-bahasa-v1'
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(localKey) || '{"attempts":[]}') }
  catch { return { attempts: [] } }
}
const saveLocal = (attempts) => localStorage.setItem(localKey, JSON.stringify({ attempts }))
const formatDate = (date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const imageLabel = {
  rain: 'Ilustrasi proses hujan dan awan', magnify: 'Ilustrasi mencari petunjuk informasi', flow: 'Ilustrasi sebab, proses, dan akibat',
  folklore: 'Ilustrasi suasana cerita rakyat', words: 'Ilustrasi pola bunyi kata', meaning: 'Ilustrasi denotatif dan konotatif',
  writing: 'Ilustrasi kegiatan menulis', drain: 'Ilustrasi saluran air', storm: 'Ilustrasi cuaca badai', flood: 'Ilustrasi potensi banjir', litter: 'Ilustrasi lingkungan dan sampah'
}
function Picture({ name, className = '' }) {
  if (!name) return null
  return <img className={`picture ${className}`} src={`${import.meta.env.BASE_URL}illustrations/${name}.svg`} alt={imageLabel[name] || 'Ilustrasi pembelajaran'} />
}
function IconBox({ icon: Icon, tone = 'blue' }) { return <span className={`icon-box ${tone}`}><Icon size={19} /></span> }
function ProgressBar({ value = 0, color = 'teal' }) { return <div className={`progress-track ${color}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div> }
function StatCard({ icon: Icon, value, label, tone = 'blue', sub }) {
  return <div className="stat-card"><IconBox icon={Icon} tone={tone} /><div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{sub && <div className="stat-sub">{sub}</div>}</div></div>
}
function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('jb-user') || 'null') } catch { return null } })
  const [page, setPage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attempts, setAttempts] = useState(() => readLocal().attempts || [])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [activeLessonId, setActiveLessonId] = useState(lessons[0].id)
  const [test, setTest] = useState(null)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState('')
  const [guidedIndex, setGuidedIndex] = useState(0)
  const [showGuided, setShowGuided] = useState(false)
  const [writerText, setWriterText] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [reviewScore, setReviewScore] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [authTab, setAuthTab] = useState('demo')
  const [authName, setAuthName] = useState('')
  const [authClass, setAuthClass] = useState('VI A')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authRole, setAuthRole] = useState('student')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!user) return
    localStorage.setItem('jb-user', JSON.stringify(user))
    if (user.cloud && supabase) {
      setCloudLoading(true)
      loadCloudAttempts(user.role === 'teacher', user.id)
        .then((data) => setAttempts(data))
        .catch((err) => setCloudError(`Tidak dapat memuat progres daring: ${err.message}`))
        .finally(() => setCloudLoading(false))
    } else {
      setAttempts(readLocal().attempts || [])
    }
  }, [user])

  useEffect(() => {
    if (!user?.cloud || user.role !== 'teacher' || !supabase) return
    const channel = supabase.channel('teacher-live-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attempts' }, () => {
        loadCloudAttempts(true, user.id).then(setAttempts).catch((e) => setCloudError(e.message))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, user?.role, user?.cloud])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const isTeacher = user?.role === 'teacher'
  const activeLesson = lessons.find((x) => x.id === activeLessonId) || lessons[0]
  const studentAttempts = useMemo(() => isTeacher ? attempts : attempts.filter((a) => a.userId === user?.id || (!a.userId && a.studentName === user?.name)), [attempts, isTeacher, user])
  const average = studentAttempts.length ? Math.round(studentAttempts.reduce((a, b) => a + Number(b.score || 0), 0) / studentAttempts.length) : 0
  const latest = studentAttempts[0]

  useEffect(() => {
    if (!isCloudEnabled || user) return
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return
      try {
        const profile = await getProfile(data.session.user.id)
        if (profile) setUser({ id: profile.id, name: profile.full_name, className: profile.class_name, role: profile.role, cloud: true, email: data.session.user.email })
      } catch (e) { setCloudError(e.message) }
    })
  }, [])

  const go = (p) => { setPage(p); setSidebarOpen(false); setSearchTerm('') }
  const loginDemo = () => {
    if (!authName.trim()) { setAuthError('Tuliskan nama terlebih dahulu.'); return }
    const demoUser = { id: `demo-${authRole}-${authName.trim().toLowerCase().replace(/\s+/g, '-')}`, name: authName.trim(), className: authClass || 'VI A', role: authRole, cloud: false }
    setUser(demoUser); setAuthError(''); setPage('home'); setToast(`Selamat belajar, ${demoUser.name}!`)
  }
  const submitAuth = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthMessage('')
    if (!supabase) { setAuthError('Koneksi Supabase belum diatur. Gunakan Mode Demo atau isi .env pada proyek.'); return }
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError('Email dan kata sandi harus diisi.'); return }
    setAuthBusy(true)
    try {
      let authUser
      if (authTab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword, options: { data: { full_name: authName.trim(), class_name: authClass } } })
        if (error) throw error
        authUser = data.user
        if (!data.session) { setAuthMessage('Akun dibuat. Periksa email untuk verifikasi, lalu masuk.'); setAuthTab('login'); setAuthBusy(false); return }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        if (error) throw error
        authUser = data.user
      }
      let profile = await getProfile(authUser.id)
      if (!profile) profile = await ensureStudentProfile(authUser, authName.trim(), authClass)
      setUser({ id: profile.id, name: profile.full_name, className: profile.class_name, role: profile.role, cloud: true, email: authUser.email })
      setAuthMessage(''); setPage('home'); setToast('Berhasil masuk. Progres tersimpan di database.')
    } catch (err) { setAuthError(err.message || 'Terjadi kesalahan saat masuk.') }
    finally { setAuthBusy(false) }
  }
  const logout = async () => {
    if (user?.cloud && supabase) await supabase.auth.signOut()
    localStorage.removeItem('jb-user'); setUser(null); setPage('home'); setTest(null); setResult(null)
  }

  const buildTest = () => {
    const pick = (type, count) => shuffle(questionBank.filter((q) => q.type === type)).slice(0, count)
    const objective = [
      ...pick('tf', 3), ...pick('mcq', 5), ...pick('multi', 2), ...pick('fill', 2)
    ].map((q) => {
      if (!q.options) return q
      const shuffledOptions = shuffle(q.options.map(([originalId, text]) => ({ originalId, text })))
      const options = shuffledOptions.map((option, index) => ({ id: 'ABCD'[index], text: option.text, originalId: option.originalId }))
      const remap = (id) => options.find((option) => option.originalId === id)?.id
      const answer = Array.isArray(q.answer) ? q.answer.map(remap) : remap(q.answer)
      return { ...q, answer, options }
    })
    const essays = shuffle([
      { id: 'essay-a', type: 'essay', topic: 'Cerita rakyat', prompt: 'Buat tanggapan singkat terhadap tokoh yang mengambil barang milik orang lain lalu menyadari kesalahannya. Tuliskan satu nilai moral dan saran perbaikan.', rubric: ['Tanggapan berdasarkan tindakan tokoh (0–2)', 'Nilai moral tepat (0–2)', 'Saran santun dan logis (0–2)', 'Kalimat jelas (0–2)'] },
      { id: 'essay-b', type: 'essay', topic: 'Menulis cerita', prompt: 'Buat rancangan cerita pendek tentang kegiatan membantu keluarga. Tuliskan tema, nama tokoh, dua watak, dan latar tempat.', rubric: ['Tema relevan (0–2)', 'Tokoh dan watak jelas (0–2)', 'Latar tepat (0–2)', 'Susunan mudah dipahami (0–2)'] },
      { id: 'essay-c', type: 'essay', topic: 'Makna kata', prompt: 'Buat masing-masing satu kalimat yang menggunakan kata “tangan” secara denotatif dan satu ungkapan konotatif. Jelaskan perbedaannya.', rubric: ['Contoh denotatif benar (0–2)', 'Contoh konotatif benar (0–2)', 'Penjelasan perbedaan (0–2)', 'Ejaan dan kejelasan (0–2)'] },
      { id: 'essay-d', type: 'essay', topic: 'Teks eksplanasi', prompt: 'Jelaskan dengan 3–4 kalimat bagaimana genangan dapat terjadi ketika saluran air tersumbat. Gunakan satu konjungsi sebab-akibat dan satu konjungsi kronologis.', rubric: ['Urutan proses logis (0–2)', 'Hubungan sebab-akibat tepat (0–2)', 'Konjungsi digunakan tepat (0–2)', 'Kalimat jelas (0–2)'] },
    ]).slice(0, 2)
    const items = shuffle([...objective, ...essays])
    setTest({ items, answers: {}, startedAt: Date.now() }); setResult(null); setPage('test')
  }
  const setAnswer = (id, value) => setTest((prev) => ({ ...prev, answers: { ...prev.answers, [id]: value } }))
  const isCorrectAnswer = (q, value) => {
    if (q.type === 'essay') return null
    if (q.type === 'tf' || q.type === 'mcq') return String(value || '') === String(q.answer)
    if (q.type === 'multi') return Array.isArray(value) && value.length === q.answer.length && [...value].sort().every((v, i) => v === [...q.answer].sort()[i])
    if (q.type === 'fill') {
      const norm = (v) => String(v || '').toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ')
      return (q.answer || []).some((a) => norm(a) === norm(value))
    }
    return false
  }
  const submitTest = async () => {
    if (!test) return
    const unanswered = test.items.filter((q) => q.type !== 'essay' && (test.answers[q.id] === undefined || test.answers[q.id] === '' || (Array.isArray(test.answers[q.id]) && !test.answers[q.id].length))).length
    if (unanswered && !window.confirm(`Masih ada ${unanswered} soal objektif yang belum dijawab. Tetap kumpulkan?`)) return
    const objectiveItems = test.items.filter((q) => q.type !== 'essay')
    const correct = objectiveItems.filter((q) => isCorrectAnswer(q, test.answers[q.id])).length
    const score = objectiveItems.length ? Math.round((correct / objectiveItems.length) * 100) : 0
    const responses = test.items.map((q) => ({
      questionId: q.id, type: q.type, topic: q.topic, prompt: q.prompt,
      studentAnswer: test.answers[q.id] ?? '', correctAnswer: q.answer ?? null,
      explanation: q.explanation || '', isCorrect: q.type === 'essay' ? null : isCorrectAnswer(q, test.answers[q.id]),
      rubric: q.rubric || null,
    }))
    const record = { id: `local-${Date.now()}`, userId: user.id, studentName: user.name, className: user.className, type: 'Uji pemahaman acak', score, total: objectiveItems.length, correct, duration: Math.round((Date.now() - test.startedAt) / 1000), responses, createdAt: new Date().toISOString() }
    setResult(record); setTest(null); setPage('result')
    if (user.cloud && supabase) {
      try {
        await saveCloudAttempt(user.id, record)
        const data = await loadCloudAttempts(user.role === 'teacher', user.id); setAttempts(data)
        setToast('Hasil tersimpan dan tersinkron ke database.')
      } catch (err) { setCloudError(`Hasil belum tersimpan daring: ${err.message}`); setToast('Ujian selesai, tetapi sinkronisasi gagal.') }
    } else {
      const local = readLocal().attempts || []
      const next = [record, ...local]; saveLocal(next); setAttempts(next)
      setToast('Hasil tersimpan di perangkat ini.')
    }
  }

  const exportCSV = () => {
    const rows = [['Nama siswa','Kelas','Tanggal','Jenis','Skor','Benar','Jumlah objektif','Durasi (detik)','Jawaban uraian']]
    attempts.forEach((a) => {
      const essays = (a.responses || []).filter((r) => r.type === 'essay').map((r) => `${r.prompt}: ${r.studentAnswer}`).join(' | ')
      rows.push([a.studentName, a.className, a.createdAt, a.type, a.score, a.correct, a.total, a.duration, essays])
    })
    const blob = new Blob([rows.map((r) => r.map(escapeCSV).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'progres-jelajah-bahasa.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const saveReview = async () => {
    if (!reviewing || reviewScore === '') return
    try {
      const num = Math.max(0, Math.min(100, Number(reviewScore)))
      if (user.cloud && supabase && !String(reviewing.id).startsWith('local-')) {
        await reviewCloudAttempt(reviewing.id, num, reviewFeedback)
        const data = await loadCloudAttempts(true, user.id); setAttempts(data)
      } else {
        const local = readLocal().attempts.map((a) => a.id === reviewing.id ? { ...a, essayScore: num, teacherFeedback: reviewFeedback, reviewedAt: new Date().toISOString() } : a)
        saveLocal(local); setAttempts(local)
      }
      setReviewing(null); setReviewScore(''); setReviewFeedback(''); setToast('Penilaian uraian disimpan.')
    } catch (err) { setCloudError(`Gagal menyimpan penilaian: ${err.message}`) }
  }

  if (!user) return <LoginScreen {...{ authTab, setAuthTab, authName, setAuthName, authClass, setAuthClass, authEmail, setAuthEmail, authPassword, setAuthPassword, authRole, setAuthRole, authBusy, authError, authMessage, loginDemo, submitAuth }} />

  const navGroups = [
    { title: 'BELAJAR', items: [ ['home','Beranda',Home], ['blueprint','Kisi-kisi',ClipboardList], ['lessons','Materi belajar',BookOpen], ['guided','Latihan terbimbing',Brain], ['test-start','Uji pemahaman',Target] ] },
    { title: 'PANTAU', items: isTeacher ? [['teacher','Progres murid',BarChart3],['keys','Kunci & bank soal',KeyRound]] : [['my-progress','Progres saya',TrendingUp]] },
  ]

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><BookOpen size={23}/></div><div><div className="brand-name">Jelajah Bahasa</div><div className="brand-sub">Ruang Belajar Kelas VI</div></div><button className="icon-btn mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><X size={19}/></button></div>
      <div className="side-profile"><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><div className="side-profile-text"><strong>{user.name}</strong><span>{isTeacher ? 'Akun Guru' : `Siswa · ${user.className}`}</span></div><span className={`connection-dot ${user.cloud ? 'online' : ''}`} title={user.cloud ? 'Tersambung ke database' : 'Mode demo lokal'} /></div>
      {navGroups.map((group) => <div className="nav-group" key={group.title}><div className="nav-label">{group.title}</div>{group.items.map(([id,label,Icon]) => <button key={id} className={`nav-item ${page === id || (id === 'lessons' && page === 'lesson-detail') || (id === 'test-start' && ['test','result'].includes(page)) ? 'active' : ''}`} onClick={() => id === 'test-start' ? (buildTest()) : go(id)}><Icon size={18}/><span>{label}</span>{id === 'test-start' && <span className="nav-new">Acak</span>}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="side-tip"><Sparkles size={16}/><p>Belajar sedikit demi sedikit. Setiap langkah membuatmu lebih percaya diri.</p></div><button className="nav-item logout" onClick={logout}><LogOut size={18}/><span>Keluar</span></button></div>
    </aside>
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={21}/></button><div className="crumb">Bahasa Indonesia <ChevronRight size={14}/> <strong>{pageTitle(page)}</strong></div><div className="topbar-right"><span className={`sync-pill ${user.cloud ? 'synced' : ''}`}><span className="sync-dot"/>{user.cloud ? 'Tersinkron' : 'Mode lokal'}</span><button className="avatar small" onClick={() => go(isTeacher ? 'teacher' : 'my-progress')} title="Profil">{user.name?.slice(0,1).toUpperCase()}</button></div></header>
      <div className="content-wrap">
        {cloudError && <div className="notice warning"><AlertCircle size={17}/><span>{cloudError}</span><button onClick={() => setCloudError('')}><X size={15}/></button></div>}
        {page === 'home' && <HomePage {...{ user, isTeacher, studentAttempts, average, latest, go, buildTest, cloudLoading }} />}
        {page === 'blueprint' && <BlueprintPage />}
        {page === 'lessons' && <LessonsPage onOpen={(id) => { setActiveLessonId(id); setPage('lesson-detail') }} />}
        {page === 'lesson-detail' && <LessonDetail lesson={activeLesson} onBack={() => go('lessons')} onPractice={() => go('guided')} />}
        {page === 'guided' && <GuidedPage {...{ guidedIndex, setGuidedIndex, showGuided, setShowGuided, writerText, setWriterText }} />}
        {page === 'test' && test && <TestPage {...{ test, setAnswer, submitTest }} />}
        {page === 'result' && result && <ResultPage result={result} onAgain={buildTest} onHome={() => go('home')} />}
        {page === 'my-progress' && <MyProgress attempts={studentAttempts} average={average} />}
        {page === 'teacher' && isTeacher && <TeacherPage {...{ attempts, cloudLoading, user, exportCSV, setReviewing: (a) => { setReviewing(a); setReviewScore(a.essayScore ?? ''); setReviewFeedback(a.teacherFeedback ?? '') }, isCloudEnabled }} />}
        {page === 'keys' && isTeacher && <KeysPage {...{ showKey, setShowKey, searchTerm, setSearchTerm }} />}
      </div>
      <footer className="footer"><span>Jelajah Bahasa · Bahasa Indonesia Kelas VI</span><span>Belajar memahami, menalar, dan berkarya.</span></footer>
    </main>
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    {reviewing && <ReviewModal {...{ reviewing, reviewScore, setReviewScore, reviewFeedback, setReviewFeedback, saveReview, onClose: () => setReviewing(null) }} />}
  </div>
}

function pageTitle(page) {
  return ({ home:'Beranda', blueprint:'Kisi-kisi', lessons:'Materi belajar', 'lesson-detail':'Materi belajar', guided:'Latihan terbimbing', test:'Uji pemahaman', result:'Hasil belajar', 'my-progress':'Progres saya', teacher:'Progres murid', keys:'Kunci & bank soal' })[page] || 'Belajar'
}

function LoginScreen(props) {
  const { authTab,setAuthTab,authName,setAuthName,authClass,setAuthClass,authEmail,setAuthEmail,authPassword,setAuthPassword,authRole,setAuthRole,authBusy,authError,authMessage,loginDemo,submitAuth } = props
  return <div className="login-page"><div className="login-left"><div className="login-brand"><div className="brand-mark large"><BookOpen size={28}/></div><span>Jelajah Bahasa</span></div><div className="login-copy"><span className="eyebrow light">RUANG BELAJAR BAHASA INDONESIA KELAS VI</span><h1>Belajar memahami teks, berpikir kritis, dan menulis cerita.</h1><p>Materi langkah demi langkah, latihan dengan petunjuk, soal acak, serta progres belajar yang dapat dipantau guru.</p><div className="login-features"><span><CheckCircle2 size={16}/> Materi dan ilustrasi</span><span><CheckCircle2 size={16}/> Latihan terbimbing</span><span><CheckCircle2 size={16}/> Progres pembelajaran</span></div></div><div className="login-art"><div className="art-book"><BookOpen size={74}/></div><div className="floating-note note-one"><Sparkles size={16}/> Ayo belajar!</div><div className="floating-note note-two"><Target size={16}/> Pahami caranya</div></div><div className="login-footer">SDN 61 Singkawang · Tahun Ajaran 2026/2027</div></div><div className="login-right"><div className="login-form-wrap"><div className="mobile-brand"><div className="brand-mark"><BookOpen size={22}/></div><strong>Jelajah Bahasa</strong></div><span className="eyebrow">SELAMAT DATANG</span><h2>Mulai perjalanan belajarmu</h2><p className="muted">Masuk untuk menyimpan dan melihat perkembangan belajar.</p><div className="auth-tabs"><button className={authTab === 'demo' ? 'selected' : ''} onClick={() => setAuthTab('demo')}>Mode demo</button><button className={authTab === 'login' ? 'selected' : ''} onClick={() => setAuthTab('login')}>Masuk online</button><button className={authTab === 'signup' ? 'selected' : ''} onClick={() => setAuthTab('signup')}>Daftar</button></div>
    {authTab === 'demo' ? <div className="form-stack"><label>Nama yang akan ditampilkan<input value={authName} onChange={(e) => props.setAuthName(e.target.value)} placeholder="Contoh: Nadia Putri" /></label><label>Kelas<select value={authClass} onChange={(e) => props.setAuthClass(e.target.value)}><option>VI A</option><option>VI B</option><option>VI C</option><option>VI</option></select></label><label>Masuk sebagai<select value={authRole} onChange={(e) => props.setAuthRole(e.target.value)}><option value="student">Murid</option><option value="teacher">Guru (demo)</option></select></label><button className="primary-btn full" onClick={loginDemo}>Mulai belajar <ArrowRight size={17}/></button><div className="auth-note"><ShieldCheck size={16}/> Mode demo menyimpan data di perangkat/browser ini. Tidak memerlukan akun.</div></div> : <form className="form-stack" onSubmit={submitAuth}>{authTab === 'signup' && <><label>Nama lengkap<input value={authName} onChange={(e) => props.setAuthName(e.target.value)} required placeholder="Nama lengkap" /></label><label>Kelas<select value={authClass} onChange={(e) => props.setAuthClass(e.target.value)}><option>VI A</option><option>VI B</option><option>VI C</option><option>VI</option></select></label></>}<label>Email<input type="email" value={authEmail} onChange={(e) => props.setAuthEmail(e.target.value)} required placeholder="nama@email.com" /></label><label>Kata sandi<input type="password" value={authPassword} onChange={(e) => props.setAuthPassword(e.target.value)} required minLength="6" placeholder="Minimal 6 karakter" /></label><button className="primary-btn full" disabled={authBusy}>{authBusy ? 'Memproses...' : authTab === 'signup' ? 'Buat akun' : 'Masuk'} <ArrowRight size={17}/></button><div className="auth-note"><Cloud size={16}/> {isCloudEnabled ? 'Akun online menyimpan progres pada database sekolah.' : 'Supabase belum dikonfigurasi. Isi berkas .env untuk mengaktifkan akun online.'}</div></form>}
    {authError && <div className="form-error"><AlertCircle size={16}/>{authError}</div>}{authMessage && <div className="form-success"><CheckCircle2 size={16}/>{authMessage}</div>}<div className="login-smallprint">Untuk akun guru online, administrator perlu mengubah peran akun menjadi <b>teacher</b> melalui petunjuk SQL di README.</div></div></div></div>
}

function HomePage({ user, isTeacher, studentAttempts, average, latest, go, buildTest }) {
  const progress = Math.min(100, Math.round((new Set(studentAttempts.flatMap((a) => a.responses?.map((r) => r.topic) || [])).size / 8) * 100))
  return <div className="page-stack"><section className="welcome-banner"><div className="welcome-copy"><span className="eyebrow light">SELAMAT DATANG DI JELAJAH BAHASA</span><h1>{isTeacher ? 'Pantau perjalanan belajar kelasmu.' : `Halo, ${user.name.split(' ')[0]}! Siap menjelajah bahasa?`}</h1><p>{isTeacher ? 'Kelola pembelajaran dan lihat capaian murid dari satu tempat.' : 'Pahami materi satu langkah demi satu langkah. Kamu bisa belajar mandiri dan mencoba soal baru setiap kali latihan.'}</p><div className="welcome-actions"><button className="white-btn" onClick={() => isTeacher ? go('teacher') : go('lessons')}>{isTeacher ? 'Lihat progres murid' : 'Mulai belajar'} <ArrowRight size={16}/></button><button className="ghost-white-btn" onClick={buildTest}><Play size={15}/> Coba uji pemahaman</button></div></div><div className="welcome-illustration"><div className="round-orbit orbit-a"/><div className="round-orbit orbit-b"/><div className="hero-book"><BookOpen size={86}/><Sparkles className="sparkle" size={25}/></div><div className="floating-chip chip-one"><Brain size={16}/> Pahami</div><div className="floating-chip chip-two"><Trophy size={16}/> Bertumbuh</div></div></section>
    <section className="stats-grid"><StatCard icon={isTeacher ? Users : ClipboardList} value={isTeacher ? new Set(studentAttempts.map((a) => a.userId)).size : studentAttempts.length} label={isTeacher ? 'Murid aktif pada data' : 'Uji pemahaman selesai'} tone="blue"/><StatCard icon={TrendingUp} value={isTeacher ? `${average}%` : `${average}%`} label={isTeacher ? 'Rata-rata nilai' : 'Rata-rata nilai saya'} tone="teal"/><StatCard icon={BookMarked} value={lessons.length} label="Materi bertahap" tone="purple"/><StatCard icon={Award} value={latest ? `${latest.score}%` : '—'} label="Nilai terakhir" tone="amber"/></section>
    <div className="home-columns"><section className="panel learning-panel"><div className="section-head"><div><span className="eyebrow">PETA BELAJAR</span><h2>Materi yang akan kamu kuasai</h2></div><button className="text-btn" onClick={() => go('lessons')}>Semua materi <ArrowRight size={15}/></button></div><div className="learning-list">{lessons.slice(0,4).map((l,i) => <button className="learning-row" key={l.id} onClick={() => { go('lessons'); }}><div className={`lesson-number color-${i+1}`}>0{i+1}</div><div className="learning-row-copy"><strong>{l.title}</strong><span>{l.eyebrow.replace(/Materi \d+ · /,'')}</span></div><span className="lesson-time"><Clock3 size={13}/>{l.minutes}</span><ChevronRight size={17}/></button>)}</div></section><section className="panel right-panel"><span className="eyebrow">TARGET BELAJAR</span><h2>Belajar sampai paham</h2><p className="muted">Selesaikan materi, coba latihan terbimbing, lalu uji pemahamanmu.</p><div className="target-progress"><div className="target-ring" style={{'--progress': `${progress}%`}}><strong>{progress}%</strong></div><div><strong>Cakupan topik</strong><span>{studentAttempts.length ? 'Topik yang sudah muncul dalam hasil latihan' : 'Belum ada hasil latihan tersimpan'}</span></div></div><div className="mini-checks"><div><CheckCircle2 size={16}/> Pelajari konsep dan contoh</div><div><CheckCircle2 size={16}/> Ikuti langkah penyelesaian</div><div><CheckCircle2 size={16}/> Evaluasi hasil belajarmu</div></div><button className="primary-btn full" onClick={() => go('guided')}>Mulai latihan terbimbing <ArrowRight size={16}/></button></section></div>
    <section className="quote-strip"><Lightbulb size={23}/><p><b>Tips belajar hari ini:</b> Jangan terburu-buru memilih jawaban. Temukan bukti pada teks atau gambar, lalu jelaskan alasanmu.</p></section></div>
}

function BlueprintPage() {
  return <div className="page-stack"><PageHeading eyebrow="PETA KOMPETENSI" title="Kisi-kisi pembelajaran" description="Peta materi dan indikator disusun dari cakupan kompetensi pada naskah Sumatif Akhir Semester Bahasa Indonesia Kelas VI. Rumusan soal asli tidak ditampilkan." /><div className="info-banner"><ClipboardList size={19}/><div><strong>Yang dipelajari dan diukur</strong><span>Kisi-kisi ini merangkum kemampuan memahami teks, menalar informasi, menguasai kebahasaan, mengapresiasi cerita, dan menulis.</span></div></div><div className="panel table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>No.</th><th>Lingkup materi</th><th>Indikator kemampuan</th><th>Materi belajar</th><th>Bentuk asesmen</th><th>Level</th></tr></thead><tbody>{blueprint.map((b,i)=><tr key={b.area}><td><span className="row-num">{String(i+1).padStart(2,'0')}</span></td><td><strong>{b.area}</strong></td><td>{b.indicator}</td><td>{b.material}</td><td>{b.forms}</td><td><span className={`level-pill ${b.level==='Mencipta'?'purple':b.level==='Menalar'?'amber':''}`}>{b.level}</span></td></tr>)}</tbody></table></div></div><div className="grid-3"><MiniInfo icon={CheckCircle2} title="Objektif" text="Benar–salah, pilihan ganda, pilihan lebih dari satu, dan isian singkat."/><MiniInfo icon={PencilLine} title="Keterampilan" text="Uraian, tanggapan, perancangan cerita, dan penulisan dialog."/><MiniInfo icon={ImageIcon} title="Literasi visual" text="Menarik simpulan dari ilustrasi cuaca, lingkungan, dan peristiwa sehari-hari."/></div></div>
}
function ImageIcon(props) { return <Eye {...props}/> }
function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function MiniInfo({ icon: Icon, title, text }) { return <div className="mini-info"><IconBox icon={Icon}/><strong>{title}</strong><p>{text}</p></div> }

function LessonsPage({ onOpen }) {
  return <div className="page-stack"><PageHeading eyebrow="BELAJAR MANDIRI" title="Materi belajar" description="Pelajari konsep, lihat ilustrasi dan contoh, lalu ikuti langkah-langkah untuk menyelesaikan soal."/><div className="lesson-grid">{lessons.map((l,i)=><button className="lesson-card" key={l.id} onClick={()=>onOpen(l.id)}><div className="lesson-card-art"><Picture name={l.image}/><span className="lesson-index">MATERI 0{i+1}</span></div><div className="lesson-card-body"><div className="lesson-card-meta"><span>{l.eyebrow.split('·')[1]}</span><span><Clock3 size={13}/>{l.minutes}</span></div><h3>{l.title}</h3><p>{l.goal}</p><div className="lesson-card-link">Pelajari materi <ArrowRight size={16}/></div></div></button>)}</div></div>
}

function LessonDetail({ lesson, onBack, onPractice }) {
  const [expanded, setExpanded] = useState(0)
  return <div className="page-stack"><button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Kembali ke semua materi</button><div className="lesson-detail-hero"><div><span className="eyebrow light">{lesson.eyebrow}</span><h1>{lesson.title}</h1><p>{lesson.goal}</p><div className="hero-meta"><span><Clock3 size={15}/>{lesson.minutes}</span><span><BookOpen size={15}/>{lesson.sections.length} bagian materi</span></div></div><Picture name={lesson.image}/></div><div className="lesson-detail-layout"><div className="lesson-content">{lesson.sections.map((s,i)=><section className={`content-section ${expanded===i?'expanded':''}`} key={s.title}><button className="content-section-title" onClick={()=>setExpanded(expanded===i?-1:i)}><span className="section-count">0{i+1}</span><strong>{s.title}</strong><ChevronDown size={18}/></button>{expanded===i && <div className="content-section-body"><p>{s.body}</p><ul>{s.bullets.map((b)=><li key={b}>{b}</li>)}</ul></div>}</section>)}<section className="example-panel"><div className="example-panel-head"><Sparkles size={17}/><strong>Ingat konsep penting</strong></div><p>{lesson.tips[0]}</p><p>{lesson.tips[1]}</p></section></div><aside className="lesson-aside"><div className="panel step-panel"><span className="eyebrow">PANDUAN MENJAWAB</span><h3>Ikuti langkah ini</h3><ol>{lesson.steps.map((s,i)=><li key={s}><span>{i+1}</span>{s}</li>)}</ol></div><div className="panel tips-panel"><Lightbulb size={19}/><h3>Tips cepat</h3>{lesson.tips.map((t)=><p key={t}>{t}</p>)}</div><button className="primary-btn full" onClick={onPractice}>Coba latihan terbimbing <ArrowRight size={16}/></button></aside></div></div>
}

function GuidedPage({ guidedIndex, setGuidedIndex, showGuided, setShowGuided, writerText, setWriterText }) {
  const example = guidedExamples[guidedIndex]
  const [writePrompt, setWritePrompt] = useState(0)
  const [showRubric, setShowRubric] = useState(false)
  return <div className="page-stack"><PageHeading eyebrow="BELAJAR DENGAN CONTOH" title="Latihan terbimbing" description="Kita pecahkan soal bersama. Baca petunjuknya, ikuti alasan setiap langkah, lalu bandingkan dengan jawaban contoh."/><div className="guided-layout"><section className="panel guided-main"><div className="guided-top"><span className="guided-label"><Brain size={15}/> CONTOH TERBIMBING {guidedIndex+1} DARI {guidedExamples.length}</span><span className="topic-pill">{example.tag}</span></div><h2>{example.title}</h2><div className="guided-question"><span className="eyebrow">PERHATIKAN SOAL</span><p>{example.prompt}</p></div><div className="guided-steps"><h3><ListChecks size={18}/> Cara berpikir langkah demi langkah</h3>{example.steps.map((s,i)=><div className="guided-step" key={s}><span>{i+1}</span><p>{s}</p></div>)}</div>{showGuided && <div className="guided-answer"><div><CheckCircle2 size={18}/><strong>Jawaban dan pembahasan</strong></div><p>{example.answer}</p><div className="tip-line"><Lightbulb size={16}/>{example.tip}</div></div>}<div className="guided-actions"><button className="secondary-btn" onClick={()=>setGuidedIndex((guidedIndex+guidedExamples.length-1)%guidedExamples.length)}><ChevronLeft size={16}/> Sebelumnya</button><button className="primary-btn" onClick={()=>setShowGuided(!showGuided)}>{showGuided?'Sembunyikan jawaban':'Lihat jawaban'} <Eye size={16}/></button><button className="secondary-btn" onClick={()=>{setGuidedIndex((guidedIndex+1)%guidedExamples.length);setShowGuided(false)}}>Berikutnya <ChevronRight size={16}/></button></div></section><aside className="panel guided-aside"><IconBox icon={Target} tone="purple"/><h3>Strategi belajar mandiri</h3><p>Coba jawab sendiri sebelum membuka pembahasan. Setelah itu, bandingkan cara berpikirmu.</p><div className="aside-steps"><span>01</span> Baca soal dua kali<span>02</span> Cari bukti dan kata kunci<span>03</span> Jelaskan alasan jawaban</div><div className="guided-progress">{guidedExamples.map((x,i)=><button key={x.title} className={i===guidedIndex?'active':''} onClick={()=>{setGuidedIndex(i);setShowGuided(false)}} title={x.title}>{i+1}</button>)}</div></aside></div><section className="panel writing-lab"><div className="writing-head"><div><span className="eyebrow">RUANG BERKARYA</span><h2>Coba menulis sendiri</h2><p>Latihan singkat untuk keterampilan menyusun cerita dan dialog.</p></div><Picture name="writing"/></div><div className="writing-prompt-tabs">{writingPrompts.map((p,i)=><button key={p.title} className={writePrompt===i?'active':''} onClick={()=>{setWritePrompt(i);setWriterText('');setShowRubric(false)}}>{p.title}</button>)}</div><p className="writing-task">{writingPrompts[writePrompt].task}</p><textarea className="writing-area" value={writerText} onChange={(e)=>setWriterText(e.target.value)} placeholder="Tuliskan gagasanmu di sini. Gunakan kalimat sendiri..." rows={5}/><div className="writing-foot"><span>{writerText.trim().split(/\s+/).filter(Boolean).length} kata</span><button className="text-btn" onClick={()=>setShowRubric(!showRubric)}>{showRubric?'Sembunyikan':'Lihat'} panduan penilaian <ChevronDown size={15}/></button></div>{showRubric && <ul className="rubric-list">{writingPrompts[writePrompt].checklist.map(x=><li key={x}><Check size={15}/>{x}</li>)}</ul>}<div className="auth-note"><ShieldCheck size={16}/> Teks latihan ini tersimpan sementara di perangkat selama halaman terbuka. Salin hasilnya sebelum keluar.</div></section></div>
}

function TestPage({ test, setAnswer, submitTest }) {
  const answered = test.items.filter((q)=>{
    const a=test.answers[q.id]; return a!==undefined && a!=='' && (!Array.isArray(a)||a.length>0)
  }).length
  return <div className="page-stack"><PageHeading eyebrow="UJI PEMAHAMAN" title="Buktikan pemahamanmu" description="Soal dipilih dan diacak dari bank soal baru. Pilih jawaban dengan teliti. Dua soal terakhir berupa uraian singkat." action={<div className="test-counter"><Target size={17}/><b>{answered}/{test.items.length}</b><span>terjawab</span></div>}/><div className="test-progress"><ProgressBar value={answered/test.items.length*100}/></div><div className="test-notice"><Lightbulb size={17}/><span>Kerjakan secara mandiri. Kunci dan pembahasan akan muncul setelah jawaban dikumpulkan. Untuk soal pilihan dua jawaban, pilih tepat dua opsi.</span></div><div className="test-list">{test.items.map((q,i)=><QuestionCard key={q.id} question={q} index={i} value={test.answers[q.id]} onChange={(v)=>setAnswer(q.id,v)}/>)}</div><div className="submit-panel"><div><strong>Sudah selesai?</strong><span>Periksa kembali jawaban sebelum mengumpulkan.</span></div><button className="primary-btn" onClick={submitTest}>Kumpulkan jawaban <ArrowRight size={17}/></button></div></div>
}
function QuestionCard({ question:q, index, value, onChange }) {
  const selected = Array.isArray(value) ? value : []
  const toggleMulti = (id) => onChange(selected.includes(id) ? selected.filter((x)=>x!==id) : selected.length < 2 ? [...selected,id] : selected)
  return <section className="panel question-card"><div className="question-head"><span className="question-no">{String(index+1).padStart(2,'0')}</span><div><span className="topic-pill">{q.topic}</span><span className="question-type">{typeLabel(q.type)}</span></div></div><p className="question-prompt">{q.prompt}</p>{q.image && <Picture name={q.image} className="question-image"/>}{q.type==='tf' && <div className="option-grid two">{[['B','Benar'],['S','Salah']].map(([id,label])=><button key={id} className={`option-btn ${value===id?'chosen':''}`} onClick={()=>onChange(id)}><span className="option-letter">{id}</span>{label}{value===id&&<Check size={16}/>}</button>)}</div>}{q.type==='mcq' && <div className="option-grid">{q.options.map((o)=><button key={o.id} className={`option-btn ${value===o.id?'chosen':''}`} onClick={()=>onChange(o.id)}><span className="option-letter">{o.id}</span><span>{o.text}</span>{value===o.id&&<Check size={16}/>}</button>)}</div>}{q.type==='multi' && <><div className="multi-hint">Pilih tepat 2 jawaban. Terpilih {selected.length}/2.</div><div className="option-grid">{q.options.map((o)=><button key={o.id} disabled={selected.length >= 2 && !selected.includes(o.id)} className={`option-btn ${selected.includes(o.id)?'chosen':''}`} onClick={()=>toggleMulti(o.id)}><span className="option-letter">{o.id}</span><span>{o.text}</span>{selected.includes(o.id)&&<Check size={16}/>}</button>)}</div></>}{q.type==='fill' && <label className="fill-answer"><span>Jawabanmu</span><input value={value||''} onChange={(e)=>onChange(e.target.value)} placeholder="Ketik jawaban singkat..."/></label>}{q.type==='essay' && <div className="essay-answer"><textarea value={value||''} onChange={(e)=>onChange(e.target.value)} rows={4} placeholder="Tuliskan jawabanmu dengan kalimat sendiri..."/><span>Jawaban uraian akan ditinjau guru menggunakan rubrik.</span></div>}</section>
}
function typeLabel(type) { return ({tf:'Benar / Salah',mcq:'Pilihan ganda',multi:'Pilih 2 jawaban',fill:'Isian singkat',essay:'Uraian'}[type] || type) }

function ResultPage({ result, onAgain, onHome }) {
  const [showReview, setShowReview] = useState(false)
  const objective = result.responses.filter((r)=>r.type!=='essay')
  const essays = result.responses.filter((r)=>r.type==='essay')
  return <div className="page-stack"><div className="result-hero"><div className="result-medal"><Trophy size={42}/></div><span className="eyebrow light">HASIL UJI PEMAHAMAN</span><h1>{result.score>=80?'Hebat! Kamu menguasai banyak konsep.':result.score>=60?'Bagus! Terus perkuat pemahamanmu.':'Tetap semangat, belajar adalah proses.'}</h1><div className="result-score">{result.score}<small>/100</small></div><p>{result.correct} dari {result.total} soal objektif dijawab benar. {essays.length} jawaban uraian menunggu penilaian guru.</p><div className="result-actions"><button className="white-btn" onClick={onAgain}>Coba soal acak lagi <RefreshCw size={16}/></button><button className="ghost-white-btn" onClick={onHome}>Kembali ke beranda</button></div></div><div className="stats-grid result-stats"><StatCard icon={CheckCircle2} value={`${result.correct}/${result.total}`} label="Jawaban benar" tone="teal"/><StatCard icon={AlertCircle} value={result.total-result.correct} label="Perlu dipelajari lagi" tone="amber"/><StatCard icon={PencilLine} value={essays.length} label="Uraian menunggu guru" tone="purple"/><StatCard icon={Clock3} value={`${Math.floor(result.duration/60)} mnt`} label="Waktu pengerjaan" tone="blue"/></div><section className="panel"><div className="section-head"><div><span className="eyebrow">TINJAUAN JAWABAN</span><h2>Belajar dari hasilmu</h2></div><button className="text-btn" onClick={()=>setShowReview(!showReview)}>{showReview?'Tutup pembahasan':'Lihat pembahasan'} <Eye size={16}/></button></div>{showReview && <div className="review-list">{result.responses.map((r,i)=><div className={`review-item ${r.type==='essay'?'pending':r.isCorrect?'correct':'incorrect'}`} key={r.questionId}><div className="review-item-top"><b>Soal {i+1}</b><span>{r.type==='essay'?'Menunggu guru':r.isCorrect?'Benar':'Perlu diperbaiki'}</span></div><p>{r.prompt}</p>{r.type==='essay'?<><div className="student-response"><b>Jawabanmu</b><p>{r.studentAnswer||'Belum dijawab'}</p></div><div className="teacher-rubric"><b>Aspek yang akan diperiksa</b><ul>{(r.rubric||[]).map(x=><li key={x}>{x}</li>)}</ul></div></>:<><div className="student-response"><b>Jawabanmu</b><p>{formatAnswer(r.studentAnswer)}</p></div>{!r.isCorrect && <div className="correct-response"><b>Kunci jawaban</b><p>{formatAnswer(r.correctAnswer)}</p></div>}<div className="explanation"><Lightbulb size={16}/>{r.explanation}</div></>}</div>)}</div>}</section></div>
}
function formatAnswer(value) { return Array.isArray(value) ? value.join(', ') : value || 'Belum dijawab' }

function MyProgress({ attempts, average }) {
  return <div className="page-stack"><PageHeading eyebrow="PERKEMBANGAN BELAJAR" title="Progres saya" description="Lihat hasil uji pemahaman, topik yang sudah kamu temui, dan bagian yang masih perlu dilatih."/><div className="stats-grid"><StatCard icon={ClipboardList} value={attempts.length} label="Uji selesai"/><StatCard icon={TrendingUp} value={`${average}%`} label="Nilai rata-rata" tone="teal"/><StatCard icon={Trophy} value={attempts.length?`${attempts[0].score}%`:'—'} label="Nilai terakhir" tone="amber"/><StatCard icon={BookOpen} value={new Set(attempts.flatMap((a)=>a.responses?.map((r)=>r.topic)||[])).size} label="Topik yang dipelajari" tone="purple"/></div><section className="panel"><div className="section-head"><div><span className="eyebrow">RIWAYAT</span><h2>Hasil latihanmu</h2></div></div>{attempts.length?<div className="attempt-list">{attempts.map((a)=><div className="attempt-row" key={a.id}><div className="attempt-icon"><FileText size={18}/></div><div className="attempt-meta"><strong>{a.type}</strong><span>{formatDate(a.createdAt)} · {a.correct}/{a.total} benar{a.essayScore!=null?` · uraian ${a.essayScore}/100`:''}</span>{a.teacherFeedback && <span className="feedback-inline">Catatan guru: {a.teacherFeedback}</span>}</div><div className="attempt-grade"><b>{a.score}%</b><ProgressBar value={a.score}/></div><span className={`grade-label ${a.score>=80?'good':a.score>=60?'fair':'need'}`}>{a.score>=80?'Sangat baik':a.score>=60?'Berkembang':'Perlu latihan'}</span></div>)}</div>:<EmptyState icon={TrendingUp} title="Belum ada progres" text="Selesaikan uji pemahaman pertama untuk melihat perkembangan belajarmu di sini."/>}</section><div className="info-banner"><Lightbulb size={19}/><div><strong>Ingat!</strong><span>Nilai bukan satu-satunya ukuran. Baca pembahasan setiap soal agar kamu memahami alasan jawaban.</span></div></div></div>
}

function TeacherPage({ attempts, cloudLoading, user, exportCSV, setReviewing, isCloudEnabled }) {
  const [filterClass, setFilterClass] = useState('Semua kelas')
  const [search, setSearch] = useState('')
  const filtered = attempts.filter((a)=>(filterClass==='Semua kelas'||a.className===filterClass)&&(`${a.studentName} ${a.className}`).toLowerCase().includes(search.toLowerCase()))
  const students = new Set(filtered.map((a)=>a.userId || a.studentName))
  const avg = filtered.length?Math.round(filtered.reduce((s,a)=>s+Number(a.score||0),0)/filtered.length):0
  const classes = ['Semua kelas',...new Set(attempts.map((a)=>a.className).filter(Boolean))]
  const pending = filtered.filter((a)=>(a.responses||[]).some((r)=>r.type==='essay') && a.essayScore==null)
  return <div className="page-stack"><PageHeading eyebrow="DASHBOARD GURU" title="Pantau progres murid" description="Hasil uji pemahaman murid tersimpan sebagai riwayat. Dengan Supabase, data baru dapat masuk dan diperbarui secara langsung." action={<button className="secondary-btn" onClick={exportCSV}><Download size={16}/> Ekspor CSV</button>}/><div className="cloud-status-panel"><div className={`cloud-status-icon ${user.cloud?'online':''}`}><Cloud size={20}/></div><div><strong>{user.cloud?'Database daring tersambung':'Mode demo lokal aktif'}</strong><span>{user.cloud?'Pembaruan progres masuk melalui sinkronisasi realtime Supabase.':'Data yang tampil berasal dari browser/perangkat ini saja. Sambungkan Supabase untuk mengumpulkan progres murid dari perangkat berbeda.'}</span></div><span className={`status-tag ${user.cloud?'green':'yellow'}`}>{user.cloud?'REALTIME':'LOKAL'}</span></div><div className="stats-grid"><StatCard icon={Users} value={students.size} label="Murid terpantau" tone="blue"/><StatCard icon={ClipboardList} value={filtered.length} label="Uji selesai" tone="purple"/><StatCard icon={TrendingUp} value={`${avg}%`} label="Rata-rata skor" tone="teal"/><StatCard icon={PencilLine} value={pending.length} label="Uraian perlu ditinjau" tone="amber"/></div><section className="panel"><div className="section-head"><div><span className="eyebrow">AKTIVITAS BELAJAR</span><h2>Riwayat hasil murid</h2></div><span className="live-indicator"><span/> {cloudLoading?'Memuat...':user.cloud?'Memantau pembaruan':'Data perangkat'}</span></div><div className="table-controls"><div className="search-field"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari nama murid..."/></div><select value={filterClass} onChange={(e)=>setFilterClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></div>{filtered.length?<div className="table-scroll"><table className="data-table teacher-table"><thead><tr><th>Murid</th><th>Kelas</th><th>Waktu</th><th>Benar</th><th>Skor</th><th>Status</th><th>Uraian</th></tr></thead><tbody>{filtered.map((a)=><tr key={a.id}><td><strong>{a.studentName}</strong></td><td>{a.className}</td><td>{formatDate(a.createdAt)}</td><td>{a.correct}/{a.total}</td><td><b>{a.score}%</b><div className="table-progress"><ProgressBar value={a.score}/></div></td><td><span className={`grade-label ${a.score>=80?'good':a.score>=60?'fair':'need'}`}>{a.score>=80?'Baik':a.score>=60?'Cukup':'Latihan'}</span></td><td>{(a.responses||[]).some((r)=>r.type==='essay')?<button className="review-link" onClick={()=>setReviewing(a)}>{a.essayScore==null?'Periksa jawaban':'Lihat nilai uraian'}</button>:'—'}</td></tr>)}</tbody></table></div>:<EmptyState icon={Users} title="Belum ada data murid" text="Hasil akan muncul setelah murid menyelesaikan uji pemahaman. Pada mode demo, data hanya terlihat di browser yang sama."/>}</section><div className="grid-2"><div className="panel teacher-note"><IconBox icon={ShieldCheck} tone="teal"/><h3>Privasi dan akses</h3><p>Setiap akun murid hanya dapat melihat hasil miliknya. Akun guru yang perannya diaktifkan dapat melihat hasil seluruh murid.</p></div><div className="panel teacher-note"><IconBox icon={KeyRound} tone="amber"/><h3>Kunci dan pembahasan</h3><p>Bank soal beserta kunci jawaban hanya tersedia pada menu guru. Murid melihat pembahasan untuk soal yang telah dikerjakan.</p></div></div></div>
}

function ReviewModal({ reviewing, reviewScore, setReviewScore, reviewFeedback, setReviewFeedback, saveReview, onClose }) {
  useEffect(() => { setReviewScore(reviewing.essayScore ?? ''); setReviewFeedback(reviewing.teacherFeedback ?? '') }, [reviewing])
  const essays=(reviewing.responses||[]).filter((r)=>r.type==='essay')
  return <div className="modal-scrim"><div className="review-modal"><div className="modal-head"><div><span className="eyebrow">PENILAIAN GURU</span><h2>Periksa jawaban uraian</h2><p>{reviewing.studentName} · {reviewing.className} · {formatDate(reviewing.createdAt)}</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div><div className="essay-review-list">{essays.map((r,i)=><div className="essay-review" key={r.questionId}><strong>Uraian {i+1}</strong><p>{r.prompt}</p><div className="student-response"><b>Jawaban murid</b><p>{r.studentAnswer||'Tidak dijawab'}</p></div><b className="rubric-title">Panduan pemeriksaan</b><ul>{(r.rubric||[]).map(x=><li key={x}>{x}</li>)}</ul></div>)}</div><label className="modal-field">Nilai uraian gabungan (0–100)<input type="number" min="0" max="100" value={reviewScore} onChange={(e)=>setReviewScore(e.target.value)} placeholder="Contoh: 85"/></label><label className="modal-field">Catatan / umpan balik<textarea rows={3} value={reviewFeedback} onChange={(e)=>setReviewFeedback(e.target.value)} placeholder="Tuliskan kekuatan jawaban dan hal yang perlu diperbaiki..."/></label><div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Batal</button><button className="primary-btn" disabled={reviewScore==='' } onClick={saveReview}>Simpan penilaian <Check size={16}/></button></div></div></div>
}

function KeysPage({ showKey, setShowKey, searchTerm, setSearchTerm }) {
  const filtered=questionBank.filter((q)=>`${q.topic} ${q.prompt}`.toLowerCase().includes(searchTerm.toLowerCase()))
  return <div className="page-stack"><PageHeading eyebrow="KHUSUS GURU" title="Bank soal dan kunci jawaban" description="Kumpulan soal latihan baru yang dibuat berdasarkan indikator kisi-kisi. Tidak memuat salinan soal asli dari naskah." action={<button className="secondary-btn" onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff size={16}/>:<Eye size={16}/>} {showKey?'Sembunyikan kunci':'Tampilkan kunci'}</button>}/><div className="info-banner"><KeyRound size={19}/><div><strong>Gunakan untuk tindak lanjut pembelajaran</strong><span>Soal pada uji pemahaman dipilih secara acak dari bank ini. Jawaban uraian diperiksa menggunakan rubrik.</span></div></div><div className="panel"><div className="table-controls"><div className="search-field"><Search size={16}/><input value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="Cari topik atau soal..."/></div><span className="muted small-text">{filtered.length} dari {questionBank.length} soal</span></div><div className="key-list">{filtered.map((q,i)=><div className="key-row" key={q.id}><div className="key-number">{i+1}</div><div className="key-body"><div className="key-meta"><span className="topic-pill">{q.topic}</span><span className="question-type">{typeLabel(q.type)}</span></div><p>{q.prompt}</p>{q.options&&<div className="key-options">{q.options.map(([id,t])=><span key={id}><b>{id}.</b> {t}</span>)}</div>}{showKey&&<div className="key-answer"><strong>Kunci: {formatAnswer(q.answer)}</strong><p>{q.explanation}</p></div>}</div></div>)}</div></div><section className="panel"><div className="section-head"><div><span className="eyebrow">PANDUAN GURU</span><h2>Acuan jawaban uraian</h2></div><span className="topic-pill">Rubrik 0–8 per tugas</span></div><div className="grid-2 essay-guide-grid"><div className="essay-guide"><strong>Menilai tokoh dan nilai moral</strong><p>Jawaban menyebut tindakan tokoh, mengaitkannya dengan nilai moral, memberi tanggapan empatik, dan menyampaikan saran secara santun.</p></div><div className="essay-guide"><strong>Merancang cerita</strong><p>Memuat tema yang dekat dengan kehidupan, nama tokoh, dua watak yang jelas, latar tempat/waktu, dan rancangan alur yang masuk akal.</p></div><div className="essay-guide"><strong>Denotatif dan konotatif</strong><p>Contoh denotatif: “Tangan Rina memegang buku.” Contoh konotatif: “Budi menjadi tangan kanan ketua.” Jelaskan bahwa contoh kedua berarti orang kepercayaan.</p></div><div className="essay-guide"><strong>Menjelaskan proses</strong><p>Uraian menjelaskan pemicu dan urutan kejadian secara logis. Gunakan konjungsi sebab-akibat (karena/sehingga) serta urutan waktu (kemudian/setelah itu).</p></div></div><p className="rubric-note">Setiap tugas dapat dinilai dari ketepatan isi (0–2), kelengkapan unsur (0–2), penalaran/keruntutan (0–2), serta kejelasan bahasa dan ejaan (0–2). Sesuaikan umpan balik dengan jawaban murid.</p></section></div>
}

function EmptyState({ icon: Icon, title, text }) { return <div className="empty-state"><div><Icon size={26}/></div><strong>{title}</strong><p>{text}</p></div> }

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
