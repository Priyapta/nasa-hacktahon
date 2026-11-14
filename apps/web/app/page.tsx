'use client';
import dynamic from 'next/dynamic';
const Workspace=dynamic(()=>import('@/components/workspace'),{ssr:false,loading:()=> <div className="loading">Opening Field Atlas…</div>});
export default function Page(){return <Workspace/>}
