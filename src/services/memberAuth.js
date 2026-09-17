export const memberAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem('memberToken')
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export const storedMember = () => {
  if (!localStorage.getItem('memberToken')) return null
  try {
    return JSON.parse(localStorage.getItem('member') || 'null')
  } catch {
    localStorage.removeItem('member')
    localStorage.removeItem('memberToken')
    return null
  }
}
