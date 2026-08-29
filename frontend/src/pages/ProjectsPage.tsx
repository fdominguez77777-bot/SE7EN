import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'

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
      <h1 className="text-2xl font-medium">Projects</h1>
      <p className="mt-1 text-sm text-stone-600">
        New projects start as DRAFT. Open them before bidders can submit.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {canManage ? (
        <form
          onSubmit={onCreate}
          className="mt-6 max-w-xl border border-stone-300 bg-white p-5"
        >
          <h2 className="text-sm font-medium">New project</h2>
          <label className="mt-3 block text-sm">
            Title
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm">
            Description
            <textarea
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Bid deadline
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create draft
          </button>
        </form>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Deadline</th>
              {canManage ? (
                <th className="px-4 py-2 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-t border-stone-200">
                <td className="px-4 py-2">{project.title}</td>
                <td className="px-4 py-2">{project.status}</td>
                <td className="px-4 py-2">
                  {project.closesAt
                    ? new Date(project.closesAt).toLocaleString()
                    : '—'}
                </td>
                {canManage ? (
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-2">
                      {project.status === 'DRAFT' ? (
                        <>
                          <button
                            type="button"
                            className="border border-stone-400 px-2 py-1"
                            onClick={() => action(`/projects/${project.id}/open`)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="border border-stone-400 px-2 py-1"
                            onClick={() =>
                              action(`/projects/${project.id}/cancel`)
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                      {project.status === 'OPEN' ? (
                        <>
                          <button
                            type="button"
                            className="border border-stone-400 px-2 py-1"
                            onClick={() =>
                              action(`/projects/${project.id}/close`)
                            }
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            className="border border-stone-400 px-2 py-1"
                            onClick={() =>
                              action(`/projects/${project.id}/cancel`)
                            }
                          >
                            Cancel
                          </button>
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
          <p className="px-4 py-6 text-sm text-stone-500">No projects yet.</p>
        ) : null}
      </div>
    </section>
  )
}
