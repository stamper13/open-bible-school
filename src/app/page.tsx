export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-center p-6">
      <h1 className="text-4xl font-bold mb-4">Open Bible School</h1>
      <p className="text-lg mb-6">
        Free Christian education resources — launching soon.
      </p>
      <p className="text-sm text-gray-500">
        © {new Date().getFullYear()} Open Bible School. All rights reserved.
      </p>
    </main>
  );
}

