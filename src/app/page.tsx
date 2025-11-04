import React from 'react';
import Sidebar from '@/component/sidebar';
import Header from '@/component/header';

export default function Home() {
  return (
    <div>
      <Sidebar>
        <Header />
      </Sidebar>
    </div>
  );
}
