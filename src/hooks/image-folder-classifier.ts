import type { CollectionAfterChangeHook } from 'payload'
/**
 * This function is to return a hooks.afterChange function for CollectionHook that
 * updates the image object's folder location to the appropriate collection folder in Media collection
 * when a new collection item is created or updated.
 * Ex: if a product is created, then this hook will update the image object's folder location to 'products' folder
 * in Media collection
 * @param name name of the image object field, ex: if field is called product_image, then name = product
 * @returns async function for hooks.afterChange
 */
export const ImageFolderClassifier: (name: string) => CollectionAfterChangeHook =
  (name: string): CollectionAfterChangeHook =>
  async ({ req, operation, collection, previousDoc }) => {
    if (req.data && req.data[`${name}_image`]) {
      if (operation === 'create') {
        // find the image object in the media collection
        const image_id = await req.payload.findByID({
          collection: 'media',
          id: req.data[`${name}_image`] as string,
          req, // include req to be part of existing transaction
        })
        if (image_id) {
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
            // move the image into specific collection folder
            await req.payload.update({
              collection: 'media',
              id: image_id.id,
              data: {
                folder: { id: folder.docs[0].id },
              },
              req,
            })
          }
        }
      } else if (operation == 'update' && previousDoc && previousDoc['image']) {
        // unset previous image object folder location in the media collection
        await req.payload.update({
          collection: 'media',
          id: previousDoc['image'] as string,
          data: {
            folder: null,
          },
          req, // include req to be part of existing transaction
        })
        // set the new image object folder location in the media collection
        const image_id = await req.payload.findByID({
          collection: 'media',
          id: req.data['image'] as string,
          req,
        })
        if (image_id) {
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
            // move the image into specific collection folder
            await req.payload.update({
              collection: 'media',
              id: image_id.id,
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
