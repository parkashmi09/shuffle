import { AlertTriangleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { errorMessage } from '@/lib/api/client'

const ErrorState = ({ error, title = 'Could not load' }: { error: unknown; title?: string }) => (
  <Alert variant='destructive'>
    <AlertTriangleIcon />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{errorMessage(error)}</AlertDescription>
  </Alert>
)

export default ErrorState
