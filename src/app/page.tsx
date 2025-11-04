import React from 'react';
import Sidebar from '@/component/sidebar';

export default function Home() {
  return (
    <div>
      <Sidebar>
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p>Welcome to the Pharmacy Management System Dashboard!</p>
        </div>
      </Sidebar>
    </div>
  );
}
