import { FileDownload } from './FileDownload';

export default { title: 'Files/Private download (synthetic)', component: FileDownload };
export const Default = {
  render: () => (
    <FileDownload
      file={{ contentType: 'application/pdf', contentBase64: 'JVBERg==' }}
      filename="synthetic.pdf"
      label="Synthetic download"
    />
  ),
};
