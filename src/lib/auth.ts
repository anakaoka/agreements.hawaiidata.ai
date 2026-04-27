import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { company: { select: { id: true, name: true, slug: true } } },
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword)
        if (!valid) return null

        return {
          id:          user.id,
          email:       user.email,
          name:        user.name,
          role:        user.role,
          companyId:   user.companyId,
          companyName: user.company.name,
          companySlug: user.company.slug,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id
        token.role        = (user as any).role
        token.companyId   = (user as any).companyId
        token.companyName = (user as any).companyName
        token.companySlug = (user as any).companySlug
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id          = token.id as string
        session.user.role        = token.role as string
        session.user.companyId   = token.companyId as string
        session.user.companyName = token.companyName as string
        session.user.companySlug = token.companySlug as string
      }
      return session
    },
  },
}

export const getSession = () => getServerSession(authOptions)
