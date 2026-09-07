import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'

function projectTone(status: string) {
  if (status === 'OPEN') return 'success' as const
  if (status === 'DRAFT') return 'warning' as const
  if (status === 'CANCELLED') return 'danger' as const
  return 'muted' as const
}

export function ProjectsPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const { data } = await api.get<Project[]>('/projects')
    setProjects(data)
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await api.post('/projects', {
        title,
        description: description || undefined,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      })
      setTitle('')
      setDescription('')
      setClosesAt('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function action(path: string) {
    setError('')
    try {
      await api.post(path)
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <section>
      <PageHeader
        title="Projects"
        description="New projects start as DRAFT. Open them before bidders can submit."
      />
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {canManage ? (
        <SectionCard className="mt-6 max-w-xl" title="New project">
          <form onSubmit={onCreate}>
            <label className="block text-sm text-[var(--text-secondary)]">
              Title
              <input
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--text-secondary)]">
              Description
              <textarea
                className="input-field"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--text-secondary)]">
              Bid deadline
              <input
                className="input-field"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={pending} className="mt-4">
              Create draft
            </Button>
          </form>
        </SectionCard>
      ) : null}

      <div className="table-wrap mt-8">
        <table className="table-ui">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Deadline</th>
              {canManage ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="font-semibold text-[var(--text-primary)]">{project.title}</td>
                <td>
                  <StatusBadge tone={projectTone(project.status)}>{project.status}</StatusBadge>
                </td>
                <td>
                  {project.closesAt ? new Date(project.closesAt).toLocaleString() : '—'}
                </td>
                {canManage ? (
                  <td>
                    <span className="flex flex-wrap gap-2">
                      {project.status === 'DRAFT' ? (
                        <>
                          <Button
                            variant="secondary"
                            className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                            onClick={() => action(`/projects/${project.id}/open`)}
                          >
                            Open
                          </Button>
                          <Button
                            variant="ghost"
                            className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                            onClick={() => action(`/projects/${project.id}/cancel`)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                      {project.status === 'OPEN' ? (
                        <>
                          <Button
                            variant="secondary"
                            className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                            onClick={() => action(`/projects/${project.id}/close`)}
                          >
                            Close
                          </Button>
                          <Button
                            variant="ghost"
                            className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                            onClick={() => action(`/projects/${project.id}/cancel`)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No projects yet." />
          </div>
        ) : null}
      </div>
    </section>
  )
}
