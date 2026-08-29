import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { RoleRoute } from './auth/RoleRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { CandidatesPage } from './pages/CandidatesPage'
import { DashboardPage } from './pages/DashboardPage'
import { InterviewsPage } from './pages/InterviewsPage'
import { InvitationsPage } from './pages/InvitationsPage'
import { LoginPage } from './pages/LoginPage'
import { MyProfilePage } from './pages/MyProfilePage'
import { MySubmissionsPage } from './pages/MySubmissionsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SubmissionsPage } from './pages/SubmissionsPage'
import { SubmitBidPage } from './pages/SubmitBidPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/candidates"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
                <CandidatesPage />
              </RoleRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <RoleRoute roles={['BIDDER']}>
                <MyProfilePage />
              </RoleRoute>
            }
          />
          <Route
            path="/interviews"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER', 'BIDDER']}>
                <InterviewsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
                <ProjectsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/bidders"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
                <CandidatesPage />
              </RoleRoute>
            }
          />
          <Route
            path="/invitations"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER', 'BIDDER']}>
                <InvitationsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/submissions"
            element={
              <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
                <SubmissionsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/submit-bid"
            element={
              <RoleRoute roles={['BIDDER']}>
                <SubmitBidPage />
              </RoleRoute>
            }
          />
          <Route
            path="/my-submissions"
            element={
              <RoleRoute roles={['BIDDER']}>
                <MySubmissionsPage />
              </RoleRoute>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
