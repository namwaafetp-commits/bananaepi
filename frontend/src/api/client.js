import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 60000,
})

// Attach the Supabase JWT to every request automatically
api.interceptors.request.use(async config => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return config
})

export default api
