import { CreateBountyForm } from "~~/components/bountyswipe/CreateBountyForm";
import Link from "next/link";

const CreateBountyPage = () => {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-lg">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm font-mono text-[#DDD7FE]/40 mb-8">
          <Link href="/" className="hover:text-[#DDD7FE]/70 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#DDD7FE]/70">Create Bounty</span>
        </nav>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-8">Create Bounty</h1>

        {/* Form */}
        <CreateBountyForm />
      </div>
    </div>
  );
};

export default CreateBountyPage;
