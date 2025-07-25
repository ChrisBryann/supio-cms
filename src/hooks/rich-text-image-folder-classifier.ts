import type { CollectionAfterChangeHook } from 'payload'

const getUploadValues = (children: any[]) =>
  children.filter((child) => child.type === 'upload').map((child) => child.value)
/**
 * This function is to return a hooks.afterChange function for CollectionHook that
 * updates all rich text image object's folder location to the appropriate collection folder in Media collection
 * when a new collection item is created or updated.
 * Ex: if a blog is created, then this hook will update all rich text image object's folder location to 'blogs' folder
 * in Media collection
 * @param name name of the rich text field
 * @returns async function for hooks.afterChange
 */
export const RichTextImageFolderClassifier: (name: string) => CollectionAfterChangeHook =
  (name: string): CollectionAfterChangeHook =>
  async ({ req, operation, collection, previousDoc }) => {
    if (req.data && req.data[name] && req.data[name].root?.children) {
      // get the specific collection folder in media collection
      const folder = await req.payload.find({
        collection: 'payload-folders',
        where: {
          name: {
            equals: collection.slug.toLowerCase(),
          },
        },
        req,
      })

      if (folder && folder.docs[0]) {
        if (operation === 'create') {
          // find all the rich text image object in the media collection
          req.data[name].root.children.map(async (child: any) => {
            if (child.type === 'upload') {
              // if the content is an image upload, then set the image object folder location in media collection
              // move the image into specific collection folder
              await req.payload.update({
                collection: 'media',
                id: child.value as string,
                data: {
                  folder: { id: folder.docs[0].id },
                },
                req,
              })
            }
          })
        } else if (operation == 'update' && previousDoc && previousDoc[name].root?.children) {
          // find all the deleted image object from previous version in the media collection
          const prevUploadedImages = new Set(getUploadValues(previousDoc[name].root.children))
          const newUploadedImages = new Set(getUploadValues(req.data[name].root.children))
          const deletedImages = previousDoc[name].root.children.filter(
            (child: any) => child.type === 'upload' && !newUploadedImages.has(child.value),
          )
          for (const deletedImage of deletedImages) {
            // unset previous image object folder location in the media collection
            await req.payload.update({
              collection: 'media',
              id: deletedImage.value as string,
              data: {
                folder: null,
              },
              req, // include req to be part of existing transaction
            })
          }

          const newImages = req.data[name].root.children.filter(
            (child: any) => child.type === 'upload' && !prevUploadedImages.has(child.value),
          )
          for (const newImage of newImages) {
            // set the new image object folder location in the media collection
            // move the image into specific collection folder
            await req.payload.update({
              collection: 'media',
              id: newImage.value as string,
              data: {
                folder: { id: folder.docs[0].id },
              },
              req,
            })
          }
        }
      }
    }
  }
