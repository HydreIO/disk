export default client => queries =>
  new Promise((resolve, reject) => {
    console.dir(queries, {
      depth : Infinity,
      colors: true,
    })
    client
        .multi(queries)
        .exec((error, results) => {
          if (error) {
            reject(error)
            return
          }

          for (const result of results) {
            if (result instanceof Error) {
              reject(result)
              return
            }
          }

          resolve(results)
        })
  })
