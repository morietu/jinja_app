// src/components/ui/SearchResultItem.tsx;

export type SearchResultItemProps = {
  title: string;
  subtitle?: string;
};

export function SearchResultItem({ title, subtitle }: SearchResultItemProps) {
  return (
    <div>
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  );
}

export default SearchResultItem;
