import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import App from './App';
import './style.css';
import './ppt-theme.css';
import './api.css';
import './react.css';
import './v2.css';
const exportFile=window.DashboardExcel.download;
window.DashboardExcel.download=async(...args)=>{const {default:JSZip}=await import('jszip');Object.assign(window,{JSZip});await exportFile(...args);};
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
if(location.hash.split('?')[0]==='#LOGIN')history.replaceState(null,'',location.pathname+location.search+'#LIVE');
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><App/></QueryClientProvider></StrictMode>);

import './reference.css';
