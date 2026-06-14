import type { NextApiRequest, NextApiResponse } from 'next';
import { handleApiRequest } from '../../server';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default function apiHandler(req: NextApiRequest, res: NextApiResponse) {
  return handleApiRequest(req, res);
}
