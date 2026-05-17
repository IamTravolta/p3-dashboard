import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">P3 Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Personal Portfolio &amp; Prediction Platform</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox:              'w-full',
              card:                 'bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl',
              headerTitle:          'text-white',
              headerSubtitle:       'text-zinc-400',
              formFieldLabel:       'text-zinc-300 text-sm',
              formFieldInput:       'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 rounded-lg focus:border-indigo-500 focus:ring-indigo-500',
              formButtonPrimary:    'bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold',
              footerActionLink:     'text-indigo-400 hover:text-indigo-300',
              identityPreviewText:  'text-zinc-300',
              identityPreviewEditButton: 'text-indigo-400',
              otpCodeFieldInput:    'bg-zinc-800 border-zinc-700 text-white rounded-lg',
              dividerLine:          'bg-zinc-700',
              dividerText:          'text-zinc-500',
              socialButtonsBlockButton: 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-lg',
              socialButtonsBlockButtonText: 'text-zinc-300',
            },
          }}
        />
      </div>
    </main>
  )
}
