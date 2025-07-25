import type { User } from '@/payload-types'
import type { FieldHook } from 'payload'

export const protectRoles: FieldHook<{ id: string } & User> = ({ req, data }) => {
  const isAdmin = req.user?.roles?.includes('admin')

  if (!isAdmin) {
    return ['viewer']
  }
  const userRoles = new Set(data?.roles || [])
  userRoles.add('viewer')
  return [...userRoles.values()]
}
