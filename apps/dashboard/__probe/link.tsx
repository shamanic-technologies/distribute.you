export default function Link({ href, children, ...rest }: any) { return <a href={href} {...rest}>{children}</a>; }
