import type { Access } from 'payload'
import { checkRole } from './check-role'

export const viewer: Access = ({ req: { user, origin, payloadAPI, headers } }) => {
  if (user) {
    // checks if user is admin or editor
    if (checkRole(['admin', 'editor'], user)) {
      return true
    }
    // otherwise give user access to stuff that has user.id so they can check their own profile
    // this is for viewer only
    return {
      id: {
        equals: user.id,
      },
    }
  }
  // requests from the frontend can only see the first and last names of the user (using afterRead hook), else public users cannot see
  // this request can only be made only if headers contain a shared secret or it's being called from the admin UI, the payloadAPI property will still be 'REST'
  // even if this access control is called internally because it was referenced as a relationship field in another collection
  return (
    payloadAPI === 'local' ||
    headers.get('x-frontend-secret') === process.env.PAYLOAD_FRONTEND_SHARED_SECRET
  )
}
