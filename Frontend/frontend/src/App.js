import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Navigation from './components/Navigation';
import PrivateRoute from './components/PrivateRoute';
import RoleBasedRoute from './components/RoleBasedRoute';
import AdminRoute from './components/AdminRoute';

import Home from './pages/Home';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import PublicProfile from './pages/PublicProfile';
import Conferences from './pages/Conferences';
import ConferenceDetail from './pages/ConferenceDetail';
import ConferenceCreate from './pages/ConferenceCreate';
import MyConferences from './pages/MyConferences';
import Submissions from './pages/Submissions';
import SubmissionDetail from './pages/SubmissionDetail';
import SubmissionCreate from './pages/SubmissionCreate';
import SubmissionEdit from './pages/SubmissionEdit';
import Dashboard from './pages/Dashboard';
import Archives from './pages/Archives';
import Invitations from './pages/Invitations';
import Exports from './pages/Exports';
import UsersList from './pages/UsersList';
import Search from './pages/Search';
import AdminDashboard from './pages/AdminDashboard';
import Discussions from './pages/Discussions';
import DiscussionDetail from './pages/DiscussionDetail';
import Auth from './pages/Auth';

const LayoutWithNav = () => (
  <>
    <Navigation />
    <div>
      <Outlet /> { }
    </div>
  </>
);


const LayoutWithoutNav = () => (
  <div>
    <Outlet /> { }
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
     
            <Route element={<LayoutWithoutNav />}>
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/verify-email" element={<Auth />} />
            </Route>

       
            <Route element={<LayoutWithNav />}>
              <Route path="/" element={<Home />} />
              <Route path="/conferences" element={<Conferences />} />
              <Route path="/conferences/:id" element={<ConferenceDetail />} />
              <Route path="/discussions" element={<Discussions />} />
              <Route path="/discussions/:id" element={<DiscussionDetail />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile/:userId" element={<PublicProfile />} />
              
             
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/profile/edit" element={<PrivateRoute><ProfileEdit /></PrivateRoute>} />
              <Route path="/submissions" element={<PrivateRoute><Submissions /></PrivateRoute>} />
              <Route path="/submissions/:id" element={<PrivateRoute><SubmissionDetail /></PrivateRoute>} />
              <Route path="/submissions/create/:conferenceId" element={<PrivateRoute><SubmissionCreate /></PrivateRoute>} />
              <Route path="/submissions/edit/:id" element={<PrivateRoute><SubmissionEdit /></PrivateRoute>} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/invitations" element={<PrivateRoute><Invitations /></PrivateRoute>} />
              <Route path="/exports" element={<PrivateRoute><Exports /></PrivateRoute>} />
              <Route path="/archives" element={<Archives />} />
              <Route path="/users" element={<PrivateRoute><UsersList /></PrivateRoute>} />
             
              <Route path="/conferences/create" element={<RoleBasedRoute allowedRoles={['REVIEWER', 'ADMIN']}><ConferenceCreate /></RoleBasedRoute>} />
              <Route path="/my-conferences" element={<RoleBasedRoute allowedRoles={['REVIEWER', 'ORGANIZER']}><MyConferences /></RoleBasedRoute>} />
              
          
              <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;