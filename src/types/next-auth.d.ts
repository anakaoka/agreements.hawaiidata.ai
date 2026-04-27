import 'next-auth'

declare module 'next-auth' {
  interface User {
    id:          string
    role:        string
    companyId:   string
    companyName: string
    companySlug: string
  }
  interface Session {
    user: User & {
      id:          string
      role:        string
      companyId:   string
      companyName: string
      companySlug: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:          string
    role:        string
    companyId:   string
    companyName: string
    companySlug: string
  }
}
