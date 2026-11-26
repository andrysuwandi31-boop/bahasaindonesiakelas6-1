import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null
export const isCloudEnabled = Boolean(supabase)

export async function getProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function ensureStudentProfile(authUser, fullName, className) {
  if (!supabase) return null
  const existing = await getProfile(authUser.id)
  if (existing) return existing
  const payload = { id: authUser.id, full_name: fullName || authUser.email?.split('@')[0] || 'Siswa', class_name: className || 'Kelas VI', role: 'student' }
  const { data, error } = await supabase.from('profiles').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function loadCloudAttempts(isTeacher, userId) {
  if (!supabase) return []
  let query = supabase.from('attempts').select('*, profiles(full_name,class_name)')
  if (!isTeacher) query = query.eq('user_id', userId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    studentName: a.profiles?.full_name || 'Siswa',
    className: a.profiles?.class_name || '-',
    type: a.assessment_type,
    score: a.score,
    total: a.total,
    correct: a.correct_count,
    duration: a.duration_seconds,
    createdAt: a.created_at,
    responses: a.responses || [],
    essayScore: a.essay_score,
    teacherFeedback: a.teacher_feedback,
    reviewedAt: a.reviewed_at,
  }))
}

export async function saveCloudAttempt(userId, attempt) {
  if (!supabase) return null
  const payload = {
    user_id: userId,
    assessment_type: attempt.type,
    score: attempt.score,
    total: attempt.total,
    correct_count: attempt.correct,
    duration_seconds: attempt.duration,
    responses: attempt.responses,
  }
  const { data, error } = await supabase.from('attempts').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function reviewCloudAttempt(id, essayScore, teacherFeedback) {
  if (!supabase) return null
  const { data, error } = await supabase.from('attempts').update({
    essay_score: essayScore,
    teacher_feedback: teacherFeedback,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error) throw error
  return data
}
