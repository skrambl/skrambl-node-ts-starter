test('console.log the text "Hello world!"', () => {
  console.log = jest.fn();
  require('./index');
  expect(console.log).toBeCalledTimes(1);
  expect(console.log).toHaveBeenCalledWith('Hello world!');
});
