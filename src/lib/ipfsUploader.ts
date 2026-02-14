import { IPFSUploadResult } from "@/types";

export async function uploadToIPFS(
  content: string,
  filename: string
): Promise<IPFSUploadResult> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!jwt) {
    throw new Error("Pinata JWT not configured");
  }

  const blob = new Blob([content], { type: "application/json" });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const metadata = JSON.stringify({
    name: filename,
    keyvalues: {
      app: "ChainLens",
      type: "documentation",
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({
    cidVersion: 1,
  });
  formData.append("pinataOptions", options);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  const data = await response.json();

  return {
    cid: data.IpfsHash,
    url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    size: data.PinSize,
  };
}

export async function fetchFromIPFS(cid: string): Promise<string> {
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }

  return response.text();
}
