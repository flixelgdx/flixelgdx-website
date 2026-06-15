import React from 'react';

interface DocImageProps {
  src: string;
  alt?: string;
  width?: string | number;
}

export default function DocImage({ src, alt = 'Documentation image', width = '100%' }: DocImageProps) {
  return (
    <div className="text--center margin-top--md margin-bottom--md">
      <img
        src={src}
        alt={alt}
        width={width}
        className="margin-top--lg margin-bottom--lg"
        style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
      />
    </div>
  );
}
