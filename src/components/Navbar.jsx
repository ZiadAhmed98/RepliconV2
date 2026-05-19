import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="horizontal-menu">
      <ul>
        <li>
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-line-chart'></i> Executive Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/employee" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-user-pin'></i> Employee Analytics
          </NavLink>
        </li>
        <li>
          <NavLink to="/projects" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-folder'></i> Project Deep Dive
          </NavLink>
        </li>
        <li>
          <NavLink to="/capacity" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-network-chart'></i> Capacity Hub
          </NavLink>
        </li>
        <li>
          <NavLink to="/timesheets" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-time-five'></i> Timesheet Ops
          </NavLink>
        </li>
        <li>
          <NavLink to="/new-project" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <i className='bx bx-plus-circle'></i> Add Project
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}