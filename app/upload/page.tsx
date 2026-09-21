import type { Metadata } from 'next';
import { UploadScreen } from '@/components/upload/upload-screen';

export const metadata: Metadata = { title: 'Upload' };

export default function UploadPage() {
  return <UploadScreen />;
}
