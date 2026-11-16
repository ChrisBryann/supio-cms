import type { User } from '@/payload-types'
import type { FieldHook } from 'payload'
import { checkRole } from '../access/check-role'

export const protectRoles: FieldHook<{ id: string } & User> = ({ req, data }) => {
  const isAdmin = checkRole(['admin'], req.user)

  if (!isAdmin) {
    return ['viewer']
  }
  const userRoles = new Set(data?.roles || [])
  userRoles.add('viewer')
  return [...userRoles.values()]
}
