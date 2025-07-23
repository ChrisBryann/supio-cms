import type { User } from '@/payload-types'
import type { CollectionAfterOperationHook } from 'payload'

export const SendResetPassswordEmail: CollectionAfterOperationHook = async ({ req, operation }) => {
  if (operation === 'create' && req.data) {
    // send a reset password email
    await req.payload.forgotPassword({
      collection: 'users',
      data: {
        email: req.data.email,
      },
      req,
    })
  }
}
