import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Loader2, Star, MessageSquare, ListVideo, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Course } from '../store/contentStore'
import {
  getTimestamps, addTimestamp, deleteTimestamp,
  getAllEnrollments, getComments, deleteComment,
  getRatingSummary, getRatingsList, deleteRating,
  parseTimeToSeconds, formatSeconds,
  VideoTimestamp, Enrollment, VideoComment, RatingSummary, RatingEntry,
} from '../lib/videoEngagementService'

interface CourseEngagementManagerProps {
  course: Course
  onClose: () => void
}

type Tab = 'chapters' | 'enrollments' | 'comments' | 'ratings'

export default function CourseEngagementManager({ course, onClose }: CourseEngagementManagerProps) {
  const [tab, setTab] = useState<Tab>('chapters')
  const [loading, setLoading] = useState(true)

  const [timestamps, setTimestamps] = useState<VideoTimestamp[]>([])
  const [newTime, setNewTime] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [comments, setComments] = useState<VideoComment[]>([])
  const [courseRating, setCourseRating] = useState<RatingSummary | null>(null)
  const [instructorRating, setInstructorRating] = useState<RatingSummary | null>(null)
  const [courseRatings, setCourseRatings] = useState<RatingEntry[]>([])
  const [instructorRatings, setInstructorRatings] = useState<RatingEntry[]>([])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [ts, allEnrollments, cm, cr, ir, crList, irList] = await Promise.all([
        getTimestamps(course.id),
        getAllEnrollments(),
        getComments(course.id),
        getRatingSummary(course.id, 'course'),
        getRatingSummary(course.id, 'instructor'),
        getRatingsList(course.id, 'course'),
        getRatingsList(course.id, 'instructor'),
      ])
      setTimestamps(ts)
      setEnrollments(allEnrollments.filter(e => e.courseId === course.id))
      setComments(cm)
      setCourseRating(cr)
      setInstructorRating(ir)
      setCourseRatings(crList)
      setInstructorRatings(irList)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load course data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [course.id])

  const handleAddTimestamp = async () => {
    if (!newTime.trim() || !newLabel.trim()) {
      toast.error('Enter both a time (e.g. 1:30) and a label')
      return
    }
    try {
      const seconds = parseTimeToSeconds(newTime.trim())
      const t = await addTimestamp(course.id, seconds, newLabel.trim(), timestamps.length)
      setTimestamps(prev => [...prev, t].sort((a, b) => a.timeSeconds - b.timeSeconds))
      setNewTime('')
      setNewLabel('')
      toast.success('Chapter added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add chapter')
    }
  }

  const handleDeleteTimestamp = async (id: string) => {
    try {
      await deleteTimestamp(id)
      setTimestamps(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete chapter')
    }
  }

  const handleDeleteComment = async (id: string) => {
    try {
      await deleteComment(id)
      setComments(prev => prev.filter(c => c.id !== id))
      toast.success('Comment removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  const recomputeSummary = (entries: RatingEntry[]): RatingSummary => {
    const count = entries.length
    const average = count > 0 ? Math.round((entries.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
    return { average, count, userRating: null, userFeedback: null }
  }

  const handleDeleteRating = async (entry: RatingEntry) => {
    try {
      await deleteRating(entry.id)
      if (entry.ratingType === 'course') {
        const next = courseRatings.filter(r => r.id !== entry.id)
        setCourseRatings(next)
        setCourseRating(recomputeSummary(next))
      } else {
        const next = instructorRatings.filter(r => r.id !== entry.id)
        setInstructorRatings(next)
        setInstructorRating(recomputeSummary(next))
      }
      toast.success('Rating removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete rating')
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof ListVideo }[] = [
    { id: 'chapters', label: 'Chapters', icon: ListVideo },
    { id: 'enrollments', label: `Enrollments (${enrollments.length})`, icon: Users },
    { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
    { id: 'ratings', label: `Ratings (${courseRatings.length + instructorRatings.length})`, icon: Star },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-brand-dark-card rounded-2xl overflow-hidden flex flex-col"
        >
          <div className="p-5 border-b border-gray-100 dark:border-brand-dark-border flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-brand-text dark:text-brand-dark-text truncate">{course.title}</h3>
              <p className="text-xs text-brand-muted dark:text-brand-dark-muted">Manage video chapters, enrollments, comments & ratings</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-1 px-5 pt-3 border-b border-gray-100 dark:border-brand-dark-border overflow-x-auto no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors ${
                  tab === t.id ? 'text-primary-500 border-b-2 border-primary-500' : 'text-brand-muted dark:text-brand-dark-muted hover:text-brand-text dark:hover:text-brand-dark-text'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="text-center py-10"><Loader2 size={24} className="animate-spin mx-auto text-brand-muted" /></div>
            ) : (
              <>
                {tab === 'chapters' && (
                  <div>
                    <div className="flex gap-2 mb-1.5">
                      <input
                        value={newTime}
                        onChange={e => setNewTime(e.target.value)}
                        placeholder="mm:ss e.g. 1:30"
                        className="input w-28 text-sm"
                      />
                      <input
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Chapter label, e.g. Introduction"
                        className="input flex-1 text-sm"
                      />
                      <button onClick={handleAddTimestamp} className="px-3 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors">
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="text-[11px] text-brand-muted dark:text-brand-dark-muted mb-4">
                      Use minutes:seconds — e.g. <span className="font-mono">0:05</span> for 5 seconds, <span className="font-mono">1:30</span> for 1 min 30 sec.
                    </p>
                    {timestamps.length === 0 ? (
                      <p className="text-xs text-brand-muted dark:text-brand-dark-muted text-center py-6">No chapters yet. Add one above.</p>
                    ) : (
                      <div className="space-y-1">
                        {timestamps.map(t => (
                          <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-semibold text-primary-500">{formatSeconds(t.timeSeconds)}</span>
                              <span className="text-sm text-brand-text dark:text-brand-dark-text">{t.label}</span>
                            </div>
                            <button onClick={() => handleDeleteTimestamp(t.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'enrollments' && (
                  enrollments.length === 0 ? (
                    <p className="text-xs text-brand-muted dark:text-brand-dark-muted text-center py-6">No one has enrolled yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {enrollments.map(e => (
                        <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                          <div>
                            <p className="text-sm font-semibold text-brand-text dark:text-brand-dark-text">{e.firstName} {e.lastName}</p>
                            <p className="text-xs text-brand-muted dark:text-brand-dark-muted">{e.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            e.status === 'paid' ? 'bg-green-100 text-green-700' : e.status === 'free' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {e.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'comments' && (
                  comments.length === 0 ? (
                    <p className="text-xs text-brand-muted dark:text-brand-dark-muted text-center py-6">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {comments.map(c => (
                        <div key={c.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-brand-text dark:text-brand-dark-text">{c.userName}</p>
                            <p className="text-xs text-brand-muted dark:text-brand-dark-muted break-words">{c.comment}</p>
                          </div>
                          <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'ratings' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5">
                        <p className="text-xs font-semibold text-brand-muted dark:text-brand-dark-muted uppercase mb-1">Course Rating</p>
                        <div className="flex items-center gap-2">
                          <Star size={18} className="text-amber-400 fill-amber-400" />
                          <span className="text-xl font-bold text-brand-text dark:text-brand-dark-text">{courseRating?.average || '—'}</span>
                          <span className="text-xs text-brand-muted dark:text-brand-dark-muted">({courseRating?.count ?? 0} ratings)</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5">
                        <p className="text-xs font-semibold text-brand-muted dark:text-brand-dark-muted uppercase mb-1">Instructor Rating</p>
                        <div className="flex items-center gap-2">
                          <Star size={18} className="text-amber-400 fill-amber-400" />
                          <span className="text-xl font-bold text-brand-text dark:text-brand-dark-text">{instructorRating?.average || '—'}</span>
                          <span className="text-xs text-brand-muted dark:text-brand-dark-muted">({instructorRating?.count ?? 0} ratings)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-brand-muted dark:text-brand-dark-muted uppercase mb-2">Course reviews</p>
                      {courseRatings.length === 0 ? (
                        <p className="text-xs text-brand-muted dark:text-brand-dark-muted text-center py-4">No course ratings yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {courseRatings.map(r => (
                            <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-xs font-semibold text-brand-text dark:text-brand-dark-text">{r.userName}</p>
                                  <span className="flex items-center gap-0.5 text-amber-500 text-[11px] font-bold">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />{r.rating}
                                  </span>
                                </div>
                                {r.feedback && (
                                  <p className="text-xs text-brand-muted dark:text-brand-dark-muted break-words">{r.feedback}</p>
                                )}
                              </div>
                              <button onClick={() => handleDeleteRating(r)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-brand-muted dark:text-brand-dark-muted uppercase mb-2">Instructor reviews</p>
                      {instructorRatings.length === 0 ? (
                        <p className="text-xs text-brand-muted dark:text-brand-dark-muted text-center py-4">No instructor ratings yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {instructorRatings.map(r => (
                            <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-xs font-semibold text-brand-text dark:text-brand-dark-text">{r.userName}</p>
                                  <span className="flex items-center gap-0.5 text-amber-500 text-[11px] font-bold">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />{r.rating}
                                  </span>
                                </div>
                                {r.feedback && (
                                  <p className="text-xs text-brand-muted dark:text-brand-dark-muted break-words">{r.feedback}</p>
                                )}
                              </div>
                              <button onClick={() => handleDeleteRating(r)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
